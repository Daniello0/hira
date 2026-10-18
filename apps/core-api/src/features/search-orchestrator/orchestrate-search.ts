import { randomUUID } from 'node:crypto';
import {
  IntentType,
  MessageRole,
  RetrievalBranch,
  createApiErrorResponse,
  type GenerateRequest,
  type RetrievalDiagnostics,
  type RetrievalRequest,
  type RetrievalResponse,
  type SearchIntent,
  type TokenUsage,
  type VacancyResult,
} from '@hira/contracts';
import {
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
  RATE_LIMIT_ERROR_CODE,
} from '../../common/constants/app.constants';
import { WORKING_WINDOW_SIZE, SSE_EVENT, SEARCH_UPSTREAM_MESSAGE, SEARCH_UPSTREAM_UNAVAILABLE, QUOTA_EXCEEDED_MESSAGE, titleFromFirstMessage } from '../chat/chat.constants';
import { ArchivedChatError, InvalidSearchError, QuotaDeniedError } from '../chat/chat.errors';
import { promptHistory } from '../chat/history-window';
import type { Caller } from '../chat/resolve-actor';
import type { ChatRecord, ChatStore, CompletedTurn, MessageRecord } from '../chat/chat.store';
import type { TurnContext } from '../memory/assemble-context';
import { heuristicIntent } from './heuristic-intent';
import type { LlmGateway, RetrievalGateway } from './upstream-gateway';
import type { QuotaConsumption } from '../rate-limit/search-quota';

const SEARCHING = new Set([IntentType.Search, IntentType.Refine, IntentType.Compare]);

export interface SseSink {
  open(): void;
  write(event: string, data: unknown): void;
}

export interface QuotaGate {
  consumeDemo(sessionId: string): Promise<QuotaConsumption>;
  consumeRegistered(userId: string): Promise<QuotaConsumption>;
}

export interface ContextLoad {
  caller: Caller;
  query: string;
  useMemory: boolean;
  summary: string | null;
}

export interface FollowUpJob {
  extract: boolean;
  userId: string | null;
  chatId: string | null;
  sourceMessageId: string | null;
  sourceCallTurnId: string | null;
  messageCount: number;
  previousSummary: string | null;
  exchange: { role: MessageRole; content: string }[];
}

export interface OrchestratorDeps {
  chats: ChatStore;
  llm: LlmGateway;
  retrieval: RetrievalGateway;
  quota: QuotaGate;
  logger: { warn(obj: object, message: string): void };
  now(): number;
  context?: { load(input: ContextLoad): Promise<TurnContext> };
  followUp?: { after(job: FollowUpJob): Promise<void> };
  schedule?: (task: Promise<void>) => void;
}

export interface PostMessageInput {
  caller: Caller;
  chat: ChatRecord;
  content: string;
  requestId: string;
  useMemory?: boolean;
}

export interface DirectSearchInput {
  caller: Caller;
  request: RetrievalRequest;
  requestId: string;
}

interface Understood {
  intent: SearchIntent;
  usage: TokenUsage | null;
}

interface Answer {
  text: string;
  usage: TokenUsage | null;
}

/** One chat turn. The stream opens after the user message is stored. */
export async function postChatMessage(deps: OrchestratorDeps, input: PostMessageInput, sink: SseSink): Promise<void> {
  if (input.chat.isArchived) throw new ArchivedChatError();
  const startedAt = deps.now();
  const priorCount = input.chat.messageCount;
  const useMemory = input.useMemory !== false;
  const prior = await deps.chats.recentMessages(input.chat.id, WORKING_WINDOW_SIZE);
  const user = await deps.chats.insertMessage({
    chatId: input.chat.id,
    role: MessageRole.User,
    content: input.content,
    useMemory,
  });
  await maybeTitle(deps, input, priorCount);
  sink.open();
  sink.write(SSE_EVENT.userMessage, messageEvent(user));
  const context = await readContext(deps, input, useMemory);
  const understood = await resolveIntent(deps, input.content, promptHistory(prior), context, input.requestId);
  await deps.chats.patchUserMessage(user.id, understood.intent, understood.usage);
  sink.write(SSE_EVENT.intent, understood.intent);
  const retrieval = await ranked(deps, input, user.id, understood, sink);
  if (retrieval === null) return;
  const answer = await readAnswer(deps, generateBody(understood.intent, prior, retrieval.results, context), input.requestId, sink);
  const assistant = await deps.chats.completeTurn(completed(input, user, understood, retrieval, answer));
  sink.write(SSE_EVENT.assistantMessage, messageEvent(assistant, retrieval.results));
  sink.write(SSE_EVENT.done, { messageId: assistant.id, totalLatencyMs: deps.now() - startedAt });
  scheduleFollowUp(deps, {
    extract: context.extract,
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    chatId: input.chat.id,
    sourceMessageId: user.id,
    sourceCallTurnId: null,
    messageCount: priorCount + 2,
    previousSummary: input.chat.summary,
    exchange: [
      { role: MessageRole.User, content: input.content },
      { role: MessageRole.Assistant, content: answer.text },
    ],
  });
}

/** Chat-free search. The caller already computed the intent. */
export async function runDirectSearch(deps: OrchestratorDeps, input: DirectSearchInput): Promise<RetrievalResponse> {
  await consumeOrThrow(deps, input.caller);
  const retrieval = await deps.retrieval.search(withCaller(input.request, input.caller), input.requestId);
  await deps.chats.insertSearchLog({
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    messageId: null,
    rawQuery: input.request.intent.rewrittenQuery,
    intent: input.request.intent,
    diagnostics: retrieval.diagnostics,
  });
  return retrieval;
}

async function ranked(
  deps: OrchestratorDeps,
  input: { caller: Caller; content: string; requestId: string },
  messageId: string | null,
  understood: Understood,
  sink: SseSink,
): Promise<RetrievalResponse | null> {
  if (!SEARCHING.has(understood.intent.intentType)) return publish(sink, emptyRetrieval());
  if (!(await allowSearch(deps, input.caller, sink, input.requestId))) return null;
  try {
    const retrieval = await deps.retrieval.search(chatSearchBody(understood.intent, input.caller), input.requestId);
    await deps.chats.insertSearchLog(logOf(input, messageId, understood.intent, retrieval.diagnostics));
    return publish(sink, retrieval);
  } catch (error) {
    sink.write(SSE_EVENT.error, retrievalError(error, input.requestId));
    return null;
  }
}

function publish(sink: SseSink, retrieval: RetrievalResponse): RetrievalResponse {
  sink.write(SSE_EVENT.results, { results: retrieval.results, diagnostics: retrieval.diagnostics });
  return retrieval;
}

async function allowSearch(deps: OrchestratorDeps, caller: Caller, sink: SseSink, requestId: string): Promise<boolean> {
  const result = await consume(deps, caller);
  if (result.allowed) return true;
  sink.write(SSE_EVENT.error, quotaError(result.retryAfterSeconds, requestId));
  return false;
}

async function resolveIntent(
  deps: OrchestratorDeps,
  query: string,
  history: ReturnType<typeof promptHistory>,
  context: TurnContext,
  requestId: string,
): Promise<Understood> {
  try {
    const response = await deps.llm.understand(
      { query, history, memory: context.memory, summary: context.summary, documents: context.documents },
      requestId,
    );
    return { intent: response.intent, usage: response.meta.tokenUsage };
  } catch (error) {
    deps.logger.warn({ err: error, requestId }, 'understand degraded to a heuristic intent');
    return { intent: heuristicIntent(query), usage: null };
  }
}

async function readAnswer(
  deps: OrchestratorDeps,
  request: GenerateRequest,
  requestId: string,
  sink: SseSink,
): Promise<Answer> {
  const draft = { text: '', usage: null as TokenUsage | null };
  try {
    for await (const event of deps.llm.generate(request, requestId)) applyToken(draft, event, sink);
  } catch (error) {
    deps.logger.warn({ err: error, requestId }, 'generate returned cards without prose');
  }
  return draft;
}

function applyToken(draft: Answer, event: { kind: string; delta?: string; tokenUsage?: TokenUsage }, sink: SseSink): void {
  if (event.kind === 'done' && event.tokenUsage !== undefined) draft.usage = event.tokenUsage;
  if (event.kind !== 'token' || event.delta === undefined) return;
  draft.text += event.delta;
  sink.write(SSE_EVENT.token, { delta: event.delta });
}

async function maybeTitle(deps: OrchestratorDeps, input: PostMessageInput, priorCount: number): Promise<void> {
  if (priorCount !== 0 || input.chat.title !== null) return;
  await deps.chats.setTitleIfEmpty(input.chat.id, titleFromFirstMessage(input.content));
}

async function consumeOrThrow(deps: OrchestratorDeps, caller: Caller): Promise<void> {
  const result = await consume(deps, caller);
  if (!result.allowed) throw new QuotaDeniedError(result.retryAfterSeconds);
}

function consume(deps: OrchestratorDeps, caller: Caller): Promise<QuotaConsumption> {
  if (caller.kind === 'demo') return deps.quota.consumeDemo(caller.demoSessionId);
  return deps.quota.consumeRegistered(caller.userId);
}

function chatSearchBody(intent: SearchIntent, caller: Caller): RetrievalRequest {
  return { intent, userId: caller.kind === 'user' ? caller.userId : undefined, limit: undefined as unknown as number };
}

function withCaller(request: RetrievalRequest, caller: Caller): RetrievalRequest {
  return { ...request, userId: caller.kind === 'user' ? caller.userId : undefined };
}

function generateBody(
  intent: SearchIntent,
  prior: MessageRecord[],
  results: VacancyResult[],
  context: TurnContext,
): GenerateRequest {
  return {
    intent,
    results,
    history: promptHistory(prior),
    summary: context.summary,
    documents: context.documents,
  };
}

const EMPTY_CONTEXT: TurnContext = { summary: null, memory: [], documents: [], extract: false };

async function readContext(deps: OrchestratorDeps, input: PostMessageInput, useMemory: boolean): Promise<TurnContext> {
  if (deps.context === undefined) return EMPTY_CONTEXT;
  return deps.context.load({ caller: input.caller, query: input.content, useMemory, summary: input.chat.summary });
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

function completed(
  input: PostMessageInput,
  user: MessageRecord,
  understood: Understood,
  retrieval: RetrievalResponse,
  answer: Answer,
): CompletedTurn {
  return {
    userMessageId: user.id,
    chatId: input.chat.id,
    intent: understood.intent,
    diagnostics: retrieval.diagnostics,
    understandUsage: understood.usage,
    content: answer.text,
    generateUsage: answer.usage,
    vacancies: retrieval.results.map((result, index) => ({
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

function logOf(
  input: { caller: Caller; content: string },
  messageId: string | null,
  intent: SearchIntent,
  diagnostics: RetrievalDiagnostics,
) {
  return {
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    messageId,
    rawQuery: input.content,
    intent,
    diagnostics,
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

function emptyRetrieval(): RetrievalResponse {
  const zero = { [RetrievalBranch.Lexical]: 0, [RetrievalBranch.Dense]: 0, [RetrievalBranch.Graph]: 0 };
  return {
    results: [],
    diagnostics: {
      branchTimings: zero,
      candidateCounts: zero,
      fusedCount: 0,
      relaxationSteps: [],
      rerankApplied: false,
      totalLatencyMs: 0,
    },
  };
}

function quotaError(retryAfterSeconds: number | null, requestId: string) {
  return createApiErrorResponse(
    RATE_LIMIT_ERROR_CODE,
    QUOTA_EXCEEDED_MESSAGE,
    requestId,
    retryAfterSeconds === null ? undefined : { retryAfterSeconds },
  );
}

function retrievalError(error: unknown, requestId: string) {
  if (error instanceof InvalidSearchError) {
    return createApiErrorResponse(INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE, requestId);
  }
  return createApiErrorResponse(SEARCH_UPSTREAM_UNAVAILABLE, SEARCH_UPSTREAM_MESSAGE, requestId);
}

export interface CallTurnInput {
  caller: Caller;
  session: { id: string; endedAt: Date | null };
  content: string;
  requestId: string;
  useMemory?: boolean;
  calls: {
    recentTurns(sessionId: string, limit: number): Promise<Array<{ id: string; role: string; content: string; createdAt: Date }>>;
    insertTurn(turn: {
      id: string;
      sessionId: string;
      role: 'USER' | 'ASSISTANT';
      content: string;
      useMemory: boolean;
      results: VacancyResult[] | null;
      createdAt: Date;
    }): Promise<{ id: string; role: string; content: string; createdAt: Date }>;
  };
}

/** One call replica. It reuses the chat search path and does not create a chat. */
export async function postCallTurn(deps: OrchestratorDeps, input: CallTurnInput, sink: SseSink): Promise<void> {
  if (input.session.endedAt !== null) throw new CallEndedError();
  const startedAt = deps.now();
  const useMemory = input.useMemory !== false;
  const prior = await input.calls.recentTurns(input.session.id, WORKING_WINDOW_SIZE);
  const at = new Date(deps.now());
  const user = await input.calls.insertTurn(newTurn(input, 'USER', input.content, useMemory, null, at));
  sink.open();
  sink.write(SSE_EVENT.userMessage, turnEvent(user));
  const context = await callContext(deps, input, useMemory);
  const understood = await resolveIntent(deps, input.content, promptHistory(prior.map(asMessage)), context, input.requestId);
  sink.write(SSE_EVENT.intent, understood.intent);
  const retrieval = await ranked(deps, input, null, understood, sink);
  if (retrieval === null) return;
  const answer = await readAnswer(deps, generateBody(understood.intent, prior.map(asMessage), retrieval.results, context), input.requestId, sink);
  const assistant = await input.calls.insertTurn(newTurn(input, 'ASSISTANT', answer.text, true, retrieval.results, new Date(deps.now())));
  sink.write(SSE_EVENT.assistantMessage, { ...turnEvent(assistant), results: retrieval.results });
  sink.write(SSE_EVENT.done, { messageId: assistant.id, totalLatencyMs: deps.now() - startedAt });
  scheduleFollowUp(deps, callFollowUp(input, user.id, context.extract, answer.text));
}

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

function turnEvent(turn: { id: string; role: string; content: string; createdAt: Date }) {
  return { id: turn.id, role: turn.role, content: turn.content, createdAt: turn.createdAt.toISOString() };
}

function asMessage(turn: { id: string; role: string; content: string; createdAt: Date }): MessageRecord {
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

async function callContext(deps: OrchestratorDeps, input: CallTurnInput, useMemory: boolean): Promise<TurnContext> {
  if (deps.context === undefined) return EMPTY_CONTEXT;
  return deps.context.load({ caller: input.caller, query: input.content, useMemory, summary: null });
}

function callFollowUp(input: CallTurnInput, sourceCallTurnId: string, extract: boolean, answer: string): FollowUpJob {
  return {
    extract,
    userId: input.caller.kind === 'user' ? input.caller.userId : null,
    chatId: null,
    sourceMessageId: null,
    sourceCallTurnId,
    messageCount: 0,
    previousSummary: null,
    exchange: [
      { role: MessageRole.User, content: input.content },
      { role: MessageRole.Assistant, content: answer },
    ],
  };
}
