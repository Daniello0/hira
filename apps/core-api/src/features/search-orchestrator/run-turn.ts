import {
  IntentType,
  MessageRole,
  RetrievalBranch,
  createApiErrorResponse,
  type GenerateRequest,
  type PromptTurn,
  type RetrievalRequest,
  type RetrievalResponse,
  type SearchIntent,
  type TokenUsage,
  type VacancyResult,
} from '@hira/contracts';
import { INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE } from '../../common/constants/app.constants';
import { SEARCH_UPSTREAM_MESSAGE, SEARCH_UPSTREAM_UNAVAILABLE, SSE_EVENT } from '../chat/chat.constants';
import { InvalidSearchError } from '../chat/chat.errors';
import type { Caller } from '../chat/resolve-actor';
import { withTargetDocument } from '../library/fit-documents';
import type { DraftTarget } from '../library/draft-target';
import type { TurnContext } from '../memory/assemble-context';
import { heuristicIntent } from './heuristic-intent';
import { draftEvent, isDraftTurn, loadDraftTarget, targetDocument } from './turn-draft';
import { SEARCHING_INTENTS, chargeTurn, precheckQuota } from './turn-quota';
import type { Answer, OrchestratorDeps, SseSink, TurnOptions, TurnOutcome, Understood } from './turn.types';

/** One user replica, chat or call, after it has been stored. */
export interface TurnInput extends TurnOptions {
  caller: Caller;
  content: string;
  requestId: string;
  /** Earlier turns, oldest first, without the new replica. */
  history: PromptTurn[];
  summary: string | null;
  /** Stored user message for the search log. Null for calls. */
  messageId: string | null;
  /** Runs after understand, before the intent event (the chat stores the intent here). */
  onIntent?: (understood: Understood) => Promise<void>;
}

const EMPTY_CONTEXT: TurnContext = { summary: null, memory: [], documents: [], extract: false };

/**
 * Quota pre-check, understand, quota, retrieval, answer, and the draft event.
 * Returns null when the turn stopped on an error event.
 */
export async function runTurn(deps: OrchestratorDeps, input: TurnInput, sink: SseSink): Promise<TurnOutcome | null> {
  if (!(await precheckQuota(deps, input.caller, sink, input.requestId))) return null;
  const context = await loadContext(deps, input);
  const understood = await resolveIntent(deps, input, context);
  if (input.onIntent !== undefined) await input.onIntent(understood);
  sink.write(SSE_EVENT.intent, understood.intent);
  if (!(await chargeTurn(deps, input.caller, understood, sink, input.requestId))) return null;
  const retrieval = await ranked(deps, input, understood.intent, sink);
  if (retrieval === null) return null;
  return answerTurn(deps, input, { understood, retrieval, context }, sink);
}

/** True when the client went away; follow-ups and late events are skipped. */
export function isAborted(input: TurnOptions): boolean {
  return input.signal?.aborted === true;
}

async function answerTurn(
  deps: OrchestratorDeps,
  input: TurnInput,
  turn: Pick<TurnOutcome, 'understood' | 'retrieval' | 'context'>,
  sink: SseSink,
): Promise<TurnOutcome> {
  const target = await loadDraftTarget(deps, input.caller, turn.understood, input.content);
  const answer = await readAnswer(deps, generateBody(input, turn, target), input, sink);
  if (isDraftTurn(input.caller, turn.understood) && answer.text.trim().length > 0 && !isAborted(input)) {
    sink.write(SSE_EVENT.documentDraft, draftEvent(input.content, answer.text, target));
  }
  return { ...turn, answer, extract: worthExtracting(input, turn, answer) };
}

/** Memory extraction only after a real answer: not small talk, not a degraded intent, not a dropped client. */
function worthExtracting(input: TurnInput, turn: Pick<TurnOutcome, 'understood' | 'context'>, answer: Answer): boolean {
  if (!turn.context.extract || turn.understood.degraded || isAborted(input)) return false;
  return turn.understood.intent.intentType !== IntentType.SmallTalk && answer.text.trim().length > 0;
}

async function loadContext(deps: OrchestratorDeps, input: TurnInput): Promise<TurnContext> {
  if (deps.context === undefined) return { ...EMPTY_CONTEXT, summary: input.summary };
  return deps.context.load({ caller: input.caller, query: input.content, useMemory: input.useMemory !== false, summary: input.summary });
}

async function resolveIntent(deps: OrchestratorDeps, input: TurnInput, context: TurnContext): Promise<Understood> {
  try {
    const response = await deps.llm.understand(
      { query: input.content, history: input.history, memory: context.memory, summary: context.summary, documents: context.documents },
      input.requestId,
    );
    return { intent: withForeignRemote(response.intent, input), usage: response.meta.tokenUsage, degraded: false };
  } catch (error) {
    deps.logger.warn({ err: error, requestId: input.requestId }, 'understand degraded to a heuristic intent');
    return { intent: withForeignRemote(heuristicIntent(input.content), input), usage: null, degraded: true };
  }
}

function withForeignRemote(intent: SearchIntent, input: TurnOptions): SearchIntent {
  if (input.includeForeignRemote === undefined) return intent;
  return { ...intent, hardConstraints: { ...intent.hardConstraints, includeForeignRemote: input.includeForeignRemote } };
}

async function ranked(deps: OrchestratorDeps, input: TurnInput, intent: SearchIntent, sink: SseSink): Promise<RetrievalResponse | null> {
  if (!SEARCHING_INTENTS.has(intent.intentType)) return publish(sink, emptyRetrieval());
  try {
    const retrieval = await deps.retrieval.search(chatSearchBody(intent, input.caller), input.requestId, input.signal);
    await deps.chats.insertSearchLog({
      userId: userIdOf(input.caller),
      messageId: input.messageId,
      rawQuery: input.content,
      intent,
      diagnostics: retrieval.diagnostics,
    });
    return publish(sink, retrieval);
  } catch (error) {
    if (!isAborted(input)) sink.write(SSE_EVENT.error, retrievalError(error, input.requestId));
    return null;
  }
}

async function readAnswer(deps: OrchestratorDeps, request: GenerateRequest, input: TurnInput, sink: SseSink): Promise<Answer> {
  const draft: Answer = { text: '', usage: null };
  try {
    for await (const event of deps.llm.generate(request, input.requestId, input.signal)) applyToken(draft, event, sink);
  } catch (error) {
    if (!isAborted(input)) deps.logger.warn({ err: error, requestId: input.requestId }, 'generate returned cards without prose');
  }
  return draft;
}

function applyToken(draft: Answer, event: { kind: string; delta?: string; tokenUsage?: TokenUsage }, sink: SseSink): void {
  if (event.kind === 'done' && event.tokenUsage !== undefined) draft.usage = event.tokenUsage;
  if (event.kind !== 'token' || event.delta === undefined) return;
  draft.text += event.delta;
  sink.write(SSE_EVENT.token, { delta: event.delta });
}

function generateBody(
  input: TurnInput,
  turn: Pick<TurnOutcome, 'understood' | 'retrieval' | 'context'>,
  target: DraftTarget | null,
): GenerateRequest {
  return {
    intent: turn.understood.intent,
    results: turn.retrieval.results,
    history: [...input.history, { role: MessageRole.User, content: input.content }],
    summary: turn.context.summary,
    documents: withTargetDocument(turn.context.documents, targetDocument(target)),
  };
}

function chatSearchBody(intent: SearchIntent, caller: Caller): RetrievalRequest {
  const userId = userIdOf(caller);
  return userId === null ? { intent } : { intent, userId };
}

function userIdOf(caller: Caller): string | null {
  return caller.kind === 'user' ? caller.userId : null;
}

function publish(sink: SseSink, retrieval: RetrievalResponse): RetrievalResponse {
  sink.write(SSE_EVENT.results, { results: retrieval.results, diagnostics: retrieval.diagnostics });
  return retrieval;
}

/** Ranked list of a turn that does not search. */
export function emptyRetrieval(): RetrievalResponse {
  const zero = { [RetrievalBranch.Lexical]: 0, [RetrievalBranch.Dense]: 0, [RetrievalBranch.Graph]: 0 };
  return {
    results: [] as VacancyResult[],
    diagnostics: { branchTimings: zero, candidateCounts: zero, fusedCount: 0, relaxationSteps: [], rerankApplied: false, totalLatencyMs: 0 },
  };
}

function retrievalError(error: unknown, requestId: string) {
  if (error instanceof InvalidSearchError) {
    return createApiErrorResponse(INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE, requestId);
  }
  return createApiErrorResponse(SEARCH_UPSTREAM_UNAVAILABLE, SEARCH_UPSTREAM_MESSAGE, requestId);
}
