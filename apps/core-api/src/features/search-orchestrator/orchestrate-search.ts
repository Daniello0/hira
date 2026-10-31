import { randomUUID } from 'node:crypto';
import { MessageRole, type PromptVacancy, type RetrievalResponse, type VacancyDto, type VacancyResult } from '@hira/contracts';
import { WORKING_WINDOW_SIZE, SSE_EVENT, titleFromFirstMessage } from '../chat/chat.constants';
import { ArchivedChatError } from '../chat/chat.errors';
import { promptHistory } from '../chat/history-window';
import type { Caller } from '../chat/resolve-actor';
import type { CompletedTurn, MessageRecord, ShownVacancyRecord } from '../chat/chat.store';
import { shownInOrder } from '../memory/account-activity';
import { isAborted, runTurn } from './run-turn';
import { consumeOrThrow } from './turn-quota';
import type {
  DirectSearchInput,
  FollowUpJob,
  OrchestratorDeps,
  PostMessageInput,
  SseSink,
  TurnOptions,
  TurnOutcome,
} from './turn.types';

export type {
  ContextLoad,
  DirectSearchInput,
  DraftLookup,
  FollowUpJob,
  OrchestratorDeps,
  PostMessageInput,
  QuotaGate,
  SseSink,
} from './turn.types';

/** One chat turn. The stream opens after the user message is stored. */
export async function postChatMessage(deps: OrchestratorDeps, input: PostMessageInput, sink: SseSink): Promise<void> {
  if (input.chat.isArchived) throw new ArchivedChatError();
  const startedAt = deps.now();
  const priorCount = input.chat.messageCount;
  const useMemory = input.useMemory !== false;
  const prior = await deps.chats.recentMessages(input.chat.id, WORKING_WINDOW_SIZE);
  const user = await deps.chats.insertMessage({ chatId: input.chat.id, role: MessageRole.User, content: input.content, useMemory });
  await maybeTitle(deps, input, priorCount);
  sink.open();
  sink.write(SSE_EVENT.userMessage, messageEvent(user));
  const outcome = await runTurn(deps, {
    ...turnOptions(input),
    caller: input.caller,
    content: input.content,
    requestId: input.requestId,
    history: promptHistory(prior),
    summary: input.chat.summary,
    messageId: user.id,
    chatId: input.chat.id,
    shownHere: await shownInChat(deps, prior),
    onIntent: (understood) => deps.chats.patchUserMessage(user.id, understood.intent, understood.usage),
  }, sink);
  if (outcome === null) return;
  const assistant = await deps.chats.completeTurn(completed(input, user, outcome));
  sink.write(SSE_EVENT.assistantMessage, messageEvent(assistant, outcome.retrieval.results));
  sink.write(SSE_EVENT.done, { messageId: assistant.id, totalLatencyMs: deps.now() - startedAt });
  if (isAborted(input)) return;
  scheduleFollowUp(deps, chatFollowUp(input, user.id, priorCount, outcome));
}

/** Chat-free search. The caller already computed the intent. */
export async function runDirectSearch(deps: OrchestratorDeps, input: DirectSearchInput): Promise<RetrievalResponse> {
  await consumeOrThrow(deps, input.caller);
  const retrieval = await deps.retrieval.search(withCaller(input), input.requestId);
  await deps.chats.insertSearchLog({
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    messageId: null,
    rawQuery: input.request.intent.rewrittenQuery,
    intent: input.request.intent,
    diagnostics: retrieval.diagnostics,
  });
  return retrieval;
}

/** What this chat already showed, by search. A failed read leaves the prompt without it. */
async function shownInChat(deps: OrchestratorDeps, prior: readonly MessageRecord[]): Promise<PromptVacancy[]> {
  try {
    const shown = await deps.chats.vacanciesFor(prior.map((message) => message.id));
    return shownInOrder(prior.map((message) => cardsOf(shown.filter((row) => row.messageId === message.id))));
  } catch (error) {
    deps.logger.warn({ err: error }, 'could not read the vacancies of this chat');
    return [];
  }
}

function cardsOf(rows: readonly ShownVacancyRecord[]): VacancyDto[] {
  return [...rows].sort((left, right) => left.rank - right.rank).flatMap((row) => (row.vacancy === undefined ? [] : [row.vacancy]));
}

function turnOptions(input: TurnOptions): TurnOptions {
  return { useMemory: input.useMemory, includeForeignRemote: input.includeForeignRemote, signal: input.signal, voice: input.voice };
}

async function maybeTitle(deps: OrchestratorDeps, input: PostMessageInput, priorCount: number): Promise<void> {
  if (priorCount !== 0 || input.chat.title !== null) return;
  await deps.chats.setTitleIfEmpty(input.chat.id, titleFromFirstMessage(input.content));
}

function withCaller(input: DirectSearchInput) {
  const { userId: _ignored, ...rest } = input.request;
  return input.caller.kind === 'user' ? { ...rest, userId: input.caller.userId } : rest;
}

function scheduleFollowUp(deps: OrchestratorDeps, job: FollowUpJob): void {
  if (deps.followUp === undefined) return;
  const task = deps.followUp.after(job);
  if (deps.schedule !== undefined) {
    deps.schedule(task);
    return;
  }
  task.catch((error: unknown) => deps.logger.warn({ err: error }, 'turn follow-up failed'));
}

function chatFollowUp(input: PostMessageInput, userMessageId: string, priorCount: number, outcome: TurnOutcome): FollowUpJob {
  return {
    extract: outcome.extract,
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    chatId: input.chat.id,
    sourceMessageId: userMessageId,
    sourceCallTurnId: null,
    sourceCallSessionId: null,
    previousCount: priorCount,
    messageCount: priorCount + 2,
    previousSummary: input.chat.summary,
    exchange: [
      { role: MessageRole.User, content: input.content },
      { role: MessageRole.Assistant, content: outcome.answer.text },
    ],
  };
}

function completed(input: PostMessageInput, user: MessageRecord, outcome: TurnOutcome): CompletedTurn {
  return {
    userMessageId: user.id,
    chatId: input.chat.id,
    intent: outcome.understood.intent,
    diagnostics: outcome.retrieval.diagnostics,
    understandUsage: outcome.understood.usage,
    content: outcome.answer.text,
    generateUsage: outcome.answer.usage,
    vacancies: outcome.retrieval.results.map((result, index) => ({
      vacancyId: result.vacancy.id,
      rank: index + 1,
      score: result.score,
      explanation: result.explanation,
      retrievedBy: result.retrievedBy,
      vacancy: result.vacancy,
    })),
    rawQuery: input.content,
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
  };
}

function messageEvent(message: MessageRecord, results?: VacancyResult[]) {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    ...(results === undefined ? {} : { results }),
  };
}

interface CallTurnRecord {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
  results?: VacancyResult[] | null;
}

export interface CallTurnInput extends TurnOptions {
  caller: Caller;
  session: { id: string; endedAt: Date | null };
  content: string;
  requestId: string;
  calls: {
    recentTurns(sessionId: string, limit: number): Promise<CallTurnRecord[]>;
    insertTurn(turn: {
      id: string;
      sessionId: string;
      role: 'USER' | 'ASSISTANT';
      content: string;
      useMemory: boolean;
      results: VacancyResult[] | null;
      createdAt: Date;
    }): Promise<CallTurnRecord>;
  };
}

/** One call replica. It reuses the chat turn and does not create a chat. */
export async function postCallTurn(deps: OrchestratorDeps, input: CallTurnInput, sink: SseSink): Promise<void> {
  if (input.session.endedAt !== null) throw new CallEndedError();
  const startedAt = deps.now();
  const useMemory = input.useMemory !== false;
  const prior = await input.calls.recentTurns(input.session.id, WORKING_WINDOW_SIZE);
  const user = await input.calls.insertTurn(newTurn(input, 'USER', input.content, useMemory, null, new Date(deps.now())));
  sink.open();
  sink.write(SSE_EVENT.userMessage, turnEvent(user));
  const outcome = await runTurn(deps, {
    ...turnOptions(input),
    caller: input.caller,
    content: input.content,
    requestId: input.requestId,
    history: promptHistory(prior.map(asMessage)),
    summary: null,
    messageId: null,
    callSessionId: input.session.id,
    shownHere: shownInOrder(prior.map((turn) => (turn.results ?? []).map((result) => result.vacancy))),
  }, sink);
  if (outcome === null) return;
  const results = outcome.retrieval.results;
  const assistant = await input.calls.insertTurn(newTurn(input, 'ASSISTANT', outcome.answer.text, true, results, new Date(deps.now())));
  sink.write(SSE_EVENT.assistantMessage, { ...turnEvent(assistant), results });
  sink.write(SSE_EVENT.done, { messageId: assistant.id, totalLatencyMs: deps.now() - startedAt });
  if (isAborted(input)) return;
  scheduleFollowUp(deps, callFollowUp(input, user.id, outcome));
}

/** A replica arrived after the call was ended. */
export class CallEndedError extends Error {
  constructor() {
    super('Call has already ended');
    this.name = 'CallEndedError';
  }
}

function newTurn(
  input: CallTurnInput,
  role: 'USER' | 'ASSISTANT',
  content: string,
  useMemory: boolean,
  results: VacancyResult[] | null,
  createdAt: Date,
) {
  return { id: randomUUID(), sessionId: input.session.id, role, content, useMemory, results, createdAt };
}

function turnEvent(turn: CallTurnRecord) {
  return { id: turn.id, role: turn.role, content: turn.content, createdAt: turn.createdAt.toISOString() };
}

function asMessage(turn: CallTurnRecord): MessageRecord {
  return {
    id: turn.id,
    chatId: turn.id,
    role: turn.role === 'ASSISTANT' ? MessageRole.Assistant : MessageRole.User,
    content: turn.content,
    intent: null,
    diagnostics: null,
    tokenUsage: null,
    createdAt: turn.createdAt,
  };
}

function callFollowUp(input: CallTurnInput, sourceCallTurnId: string, outcome: TurnOutcome): FollowUpJob {
  return {
    extract: outcome.extract,
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    chatId: null,
    sourceMessageId: null,
    sourceCallTurnId,
    sourceCallSessionId: input.session.id,
    previousCount: 0,
    messageCount: 0,
    previousSummary: null,
    exchange: [
      { role: MessageRole.User, content: input.content },
      { role: MessageRole.Assistant, content: outcome.answer.text },
    ],
  };
}
