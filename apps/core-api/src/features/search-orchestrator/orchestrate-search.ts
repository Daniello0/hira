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

export interface OrchestratorDeps {
  chats: ChatStore;
  llm: LlmGateway;
  retrieval: RetrievalGateway;
  quota: QuotaGate;
  logger: { warn(obj: object, message: string): void };
  now(): number;
}

export interface PostMessageInput {
  caller: Caller;
  chat: ChatRecord;
  content: string;
  requestId: string;
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
  const prior = await deps.chats.recentMessages(input.chat.id, WORKING_WINDOW_SIZE);
  const user = await deps.chats.insertMessage({ chatId: input.chat.id, role: MessageRole.User, content: input.content });
  await maybeTitle(deps, input, priorCount);
  sink.open();
  sink.write(SSE_EVENT.userMessage, messageEvent(user));
  const understood = await resolveIntent(deps, input.content, promptHistory(prior), input.requestId);
  await deps.chats.patchUserMessage(user.id, understood.intent, understood.usage);
  sink.write(SSE_EVENT.intent, understood.intent);
  const retrieval = await ranked(deps, input, user, understood, sink);
  if (retrieval === null) return;
  const answer = await readAnswer(deps, generateBody(understood.intent, prior, retrieval.results), input.requestId, sink);
  const assistant = await deps.chats.completeTurn(completed(input, user, understood, retrieval, answer));
  sink.write(SSE_EVENT.assistantMessage, messageEvent(assistant, retrieval.results));
  sink.write(SSE_EVENT.done, { messageId: assistant.id, totalLatencyMs: deps.now() - startedAt });
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
  input: PostMessageInput,
  user: MessageRecord,
  understood: Understood,
  sink: SseSink,
): Promise<RetrievalResponse | null> {
  if (!SEARCHING.has(understood.intent.intentType)) return publish(sink, emptyRetrieval());
  if (!(await allowSearch(deps, input.caller, sink, input.requestId))) return null;
  try {
    const retrieval = await deps.retrieval.search(chatSearchBody(understood.intent, input.caller), input.requestId);
    await deps.chats.insertSearchLog(logOf(input, user.id, understood.intent, retrieval.diagnostics));
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
  requestId: string,
): Promise<Understood> {
  try {
    const response = await deps.llm.understand({ query, history, memory: [] }, requestId);
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

function generateBody(intent: SearchIntent, prior: MessageRecord[], results: VacancyResult[]): GenerateRequest {
  return { intent, results, history: promptHistory(prior) };
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

function logOf(input: PostMessageInput, messageId: string, intent: SearchIntent, diagnostics: RetrievalDiagnostics) {
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
