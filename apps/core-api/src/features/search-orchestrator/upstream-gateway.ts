import type {
  ExtractMemoryRequest,
  ExtractMemoryResponse,
  GenerateRequest,
  ParseResumeRequest,
  ParseResumeResponse,
  RetrievalRequest,
  RetrievalResponse,
  SkillGapDto,
  SummarizeChatRequest,
  SummarizeChatResponse,
  TokenUsage,
  UnderstandRequest,
  UnderstandResponse,
  VacancyDto,
} from '@hira/contracts';
import { InvalidSearchError, SearchUpstreamError } from '../chat/chat.errors';
import { VacancyMissingError } from '../favorite/favorite.errors';
import { createSseParser } from './sse-parser';

export interface LlmGenerateEvent {
  kind: 'token' | 'done' | 'error';
  delta?: string;
  tokenUsage?: TokenUsage;
}

export interface LlmGateway {
  understand(request: UnderstandRequest, requestId: string): Promise<UnderstandResponse>;
  /** `signal` aborts the stream when the client goes away. */
  generate(request: GenerateRequest, requestId: string, signal?: AbortSignal): AsyncIterable<LlmGenerateEvent>;
  summarize(request: SummarizeChatRequest, requestId: string): Promise<SummarizeChatResponse>;
  extractMemory(request: ExtractMemoryRequest, requestId: string): Promise<ExtractMemoryResponse>;
  parseResume(request: ParseResumeRequest, requestId: string): Promise<ParseResumeResponse>;
}

/** Body of retrieval `POST /internal/v1/similar`. */
export interface SimilarRequest {
  vacancyId: string;
  limit?: number;
}

/** Body of retrieval `POST /internal/v1/skill-gap`. */
export interface SkillGapRequest {
  vacancyId: string;
  userId: string;
}

export interface RetrievalGateway {
  /** `signal` aborts the call when the client goes away. */
  search(request: RetrievalRequest, requestId: string, signal?: AbortSignal): Promise<RetrievalResponse>;
  similar(request: SimilarRequest, requestId: string): Promise<{ items: VacancyDto[] }>;
  skillGap(request: SkillGapRequest, requestId: string): Promise<SkillGapDto>;
}

export interface FetchLike {
  (url: string, init: RequestInit): Promise<Response>;
}

export interface GatewayOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  /** Cap for a streamed body. Defaults to `timeoutMs`. */
  streamTimeoutMs?: number;
  /** Cap for summary, memory extraction, and resume parsing, which llm-service lets run longer. */
  backgroundTimeoutMs?: number;
  fetchImpl?: FetchLike;
}

/** HTTP client for llm-service. Title failures become null so a chat can stay untitled. */
export function createLlmGateway(options: GatewayOptions): LlmGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    understand: (request, requestId) => readUnderstand(options, fetchImpl, request, requestId),
    generate: (request, requestId, signal) => readGenerate(options, fetchImpl, request, requestId, signal),
    summarize: (request, requestId) => postBackground<SummarizeChatResponse>(options, fetchImpl, '/internal/v1/summarize-chat', request, requestId),
    extractMemory: (request, requestId) => postBackground<ExtractMemoryResponse>(options, fetchImpl, '/internal/v1/extract-memory', request, requestId),
    parseResume: (request, requestId) => postBackground<ParseResumeResponse>(options, fetchImpl, '/internal/v1/parse-resume', request, requestId),
  };
}

/** HTTP client for retrieval-service: search, similar vacancies, and the skill gap. */
export function createRetrievalGateway(options: GatewayOptions): RetrievalGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    search: (request, requestId, signal) =>
      postRetrieval<RetrievalResponse>(options, fetchImpl, { path: '/internal/v1/search', body: request, requestId, signal }),
    similar: (request, requestId) =>
      postRetrieval<{ items: VacancyDto[] }>(options, fetchImpl, { path: '/internal/v1/similar', body: request, requestId }),
    skillGap: (request, requestId) =>
      postRetrieval<SkillGapDto>(options, fetchImpl, { path: '/internal/v1/skill-gap', body: request, requestId }),
  };
}

async function readUnderstand(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  body: UnderstandRequest,
  requestId: string,
): Promise<UnderstandResponse> {
  const response = await postJson<unknown>(options, fetchImpl, '/internal/v1/understand', body, requestId);
  if (!isRecord(response) || !isRecord(response.intent) || typeof response.intent.rewrittenQuery !== 'string') {
    throw new Error('invalid understand response');
  }
  return response as unknown as UnderstandResponse;
}

function postBackground<T>(options: GatewayOptions, fetchImpl: FetchLike, path: string, body: unknown, requestId: string): Promise<T> {
  return postJson<T>(options, fetchImpl, path, body, requestId, options.backgroundTimeoutMs);
}

async function postJson<T>(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  path: string,
  body: unknown,
  requestId: string,
  timeoutMs?: number,
): Promise<T> {
  const response = await call(options, fetchImpl, { path, body, requestId, timeoutMs });
  if (!response.ok) throw new Error(await errorCode(response));
  return (await response.json()) as T;
}

interface UpstreamCall {
  path: string;
  body: unknown;
  requestId: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** A 400 is a bad request, a 404 a missing vacancy; anything else, or no answer, is upstream. */
async function postRetrieval<T>(options: GatewayOptions, fetchImpl: FetchLike, upstream: UpstreamCall): Promise<T> {
  try {
    const response = await call(options, fetchImpl, upstream);
    if (response.status === 400) throw new InvalidSearchError();
    if (response.status === 404) throw new VacancyMissingError();
    if (!response.ok) throw new SearchUpstreamError();
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof InvalidSearchError || error instanceof SearchUpstreamError || error instanceof VacancyMissingError) throw error;
    throw new SearchUpstreamError();
  }
}

async function* readGenerate(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  body: GenerateRequest,
  requestId: string,
  signal?: AbortSignal,
): AsyncGenerator<LlmGenerateEvent> {
  const timeoutMs = options.streamTimeoutMs ?? options.timeoutMs;
  const response = await call(options, fetchImpl, { path: '/internal/v1/generate', body, requestId, signal, timeoutMs });
  if (!response.ok || response.body === null) throw new Error(await errorCode(response));
  yield* eventsFrom(response.body);
}

async function* eventsFrom(body: ReadableStream<Uint8Array>): AsyncGenerator<LlmGenerateEvent> {
  const parser = createSseParser();
  const reader = body.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return;
    for (const event of parser.push(decoder.decode(chunk.value, { stream: true }))) {
      const mapped = mapGenerateEvent(event.event, event.data);
      if (mapped !== null) yield mapped;
    }
  }
}

function mapGenerateEvent(event: string, data: unknown): LlmGenerateEvent | null {
  if (event === 'error') return { kind: 'error' };
  if (event === 'token' && isRecord(data) && typeof data.delta === 'string') {
    return { kind: 'token', delta: data.delta };
  }
  if (event === 'done' && isRecord(data)) return { kind: 'done', tokenUsage: readUsage(data) };
  return null;
}

function readUsage(data: Record<string, unknown>): TokenUsage | undefined {
  if (!isRecord(data.meta) || !isRecord(data.meta.tokenUsage)) return undefined;
  const usage = data.meta.tokenUsage;
  if (typeof usage.totalTokens !== 'number') return undefined;
  return usage as unknown as TokenUsage;
}

async function call(options: GatewayOptions, fetchImpl: FetchLike, upstream: UpstreamCall): Promise<Response> {
  return fetchImpl(`${options.baseUrl.replace(/\/$/, '')}${upstream.path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Internal-Token': options.token,
      'X-Request-Id': upstream.requestId,
    },
    body: JSON.stringify(upstream.body),
    signal: deadline(upstream.timeoutMs ?? options.timeoutMs, upstream.signal),
  });
}

function deadline(timeoutMs: number, signal: AbortSignal | undefined): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal === undefined ? timeout : AbortSignal.any([timeout, signal]);
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as unknown;
    if (isRecord(body) && typeof body.errorCode === 'string') return body.errorCode;
  } catch {
    return 'upstream failed';
  }
  return 'upstream failed';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
