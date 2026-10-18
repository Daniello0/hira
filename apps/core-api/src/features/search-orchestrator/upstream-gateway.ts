import type {
  ExtractMemoryRequest,
  ExtractMemoryResponse,
  GenerateRequest,
  ParseResumeRequest,
  ParseResumeResponse,
  RetrievalRequest,
  RetrievalResponse,
  SummarizeChatRequest,
  SummarizeChatResponse,
  TokenUsage,
  UnderstandRequest,
  UnderstandResponse,
} from '@hira/contracts';
import { InvalidSearchError, SearchUpstreamError } from '../chat/chat.errors';
import { createSseParser } from './sse-parser';

export interface LlmGenerateEvent {
  kind: 'token' | 'done' | 'error';
  delta?: string;
  tokenUsage?: TokenUsage;
}

export interface LlmGateway {
  understand(request: UnderstandRequest, requestId: string): Promise<UnderstandResponse>;
  generate(request: GenerateRequest, requestId: string): AsyncIterable<LlmGenerateEvent>;
  summarize(request: SummarizeChatRequest, requestId: string): Promise<SummarizeChatResponse>;
  extractMemory(request: ExtractMemoryRequest, requestId: string): Promise<ExtractMemoryResponse>;
  parseResume(request: ParseResumeRequest, requestId: string): Promise<ParseResumeResponse>;
}

export interface RetrievalGateway {
  search(request: RetrievalRequest, requestId: string): Promise<RetrievalResponse>;
}

export interface FetchLike {
  (url: string, init: RequestInit): Promise<Response>;
}

export interface GatewayOptions {
  baseUrl: string;
  token: string;
  timeoutMs: number;
  fetchImpl?: FetchLike;
}

/** HTTP client for llm-service. Title failures become null so a chat can stay untitled. */
export function createLlmGateway(options: GatewayOptions): LlmGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    understand: (request, requestId) => readUnderstand(options, fetchImpl, request, requestId),
    generate: (request, requestId) => readGenerate(options, fetchImpl, request, requestId),
    summarize: (request, requestId) => postJson<SummarizeChatResponse>(options, fetchImpl, '/internal/v1/summarize-chat', request, requestId),
    extractMemory: (request, requestId) => postJson<ExtractMemoryResponse>(options, fetchImpl, '/internal/v1/extract-memory', request, requestId),
    parseResume: (request, requestId) => postJson<ParseResumeResponse>(options, fetchImpl, '/internal/v1/parse-resume', request, requestId),
  };
}

/** HTTP client for retrieval-service. A 400 is a bad request; anything else is upstream. */
export function createRetrievalGateway(options: GatewayOptions): RetrievalGateway {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    search: (request, requestId) =>
      postRetrieval(options, fetchImpl, request, requestId),
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

async function postJson<T>(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  path: string,
  body: unknown,
  requestId: string,
): Promise<T> {
  const response = await call(options, fetchImpl, path, body, requestId);
  if (!response.ok) throw new Error(await errorCode(response));
  return (await response.json()) as T;
}

async function postRetrieval(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  body: RetrievalRequest,
  requestId: string,
): Promise<RetrievalResponse> {
  try {
    const response = await call(options, fetchImpl, '/internal/v1/search', body, requestId);
    if (response.status === 400) throw new InvalidSearchError();
    if (!response.ok) throw new SearchUpstreamError();
    return (await response.json()) as RetrievalResponse;
  } catch (error) {
    if (error instanceof InvalidSearchError || error instanceof SearchUpstreamError) throw error;
    throw new SearchUpstreamError();
  }
}

async function* readGenerate(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  body: GenerateRequest,
  requestId: string,
): AsyncGenerator<LlmGenerateEvent> {
  const response = await call(options, fetchImpl, '/internal/v1/generate', body, requestId);
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

async function call(
  options: GatewayOptions,
  fetchImpl: FetchLike,
  path: string,
  body: unknown,
  requestId: string,
): Promise<Response> {
  return fetchImpl(`${options.baseUrl.replace(/\/$/, '')}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Internal-Token': options.token,
      'X-Request-Id': requestId,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs),
  });
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
