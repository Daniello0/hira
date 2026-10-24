import type { TokenUsage } from '@hira/contracts';
import { isRecord } from '../../common/utils/is-record';
import {
  GENERATE_TEMPERATURE,
  OPENROUTER_CHAT_COMPLETIONS_PATH,
  OPENROUTER_EXCLUDE_REASONING,
  OPENROUTER_REASONING_EFFORT,
  OPENROUTER_REQUIRE_PARAMETERS,
  SEARCH_INTENT_SCHEMA_NAME,
  UNDERSTAND_TEMPERATURE,
  ZERO_TOKEN_USAGE,
} from '../llm/llm.constants';
import { LlmOutputError, ProviderTransportError } from '../llm/llm.errors';
import type { ChatMessage } from './chat-message';
import { readRetryAfter } from './read-retry-after';
import { readStreamEvents } from './read-stream-events';
import type { StreamEvent } from './stream-event';

export interface HttpInit {
  headers: Record<string, string>;
  /** Wait for the response; for a stream, the wait for its first byte. */
  timeout: number;
  /** Stream only: abort when no chunk arrives for this long. */
  idleTimeout?: number;
  responseType?: 'json' | 'stream';
}

export interface HttpPost {
  post(url: string, body: unknown, init: HttpInit): Promise<{ status: number; data: unknown; headers?: Record<string, unknown> }>;
}

/** Limits of one streamed call. */
export interface StreamLimits {
  idleTimeoutMs?: number;
  maxTokens?: number;
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface StructuredResult {
  content: string;
  tokenUsage: TokenUsage;
}

export interface OpenRouterClient {
  completeStructured(
    messages: ChatMessage[],
    schema: Record<string, unknown>,
    timeoutMs: number,
    maxTokens?: number,
  ): Promise<StructuredResult>;
  streamText(messages: ChatMessage[], timeoutMs: number, limits?: StreamLimits): AsyncIterable<StreamEvent>;
}

/** OpenRouter chat client. Callers own retries; this function performs one HTTP call. */
export function createOpenRouterClient(http: HttpPost, config: OpenRouterConfig): OpenRouterClient {
  const url = chatCompletionsUrl(config.baseUrl);
  return {
    completeStructured: (messages, schema, timeoutMs, maxTokens) =>
      completeStructured(http, config, url, { messages, schema, timeoutMs, maxTokens }),
    streamText: (messages, timeoutMs, limits) => streamText(http, config, url, { messages, timeoutMs, limits: limits ?? {} }),
  };
}

interface StructuredCall {
  messages: ChatMessage[];
  schema: Record<string, unknown>;
  timeoutMs: number;
  maxTokens?: number;
}

interface StreamCall {
  messages: ChatMessage[];
  timeoutMs: number;
  limits: StreamLimits;
}

async function completeStructured(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  call: StructuredCall,
): Promise<StructuredResult> {
  const data = await postJson(http, config, url, structuredBody(config, call), call.timeoutMs);
  return { content: readContent(data), tokenUsage: readUsage(data) ?? { ...ZERO_TOKEN_USAGE } };
}

async function* streamText(http: HttpPost, config: OpenRouterConfig, url: string, call: StreamCall): AsyncGenerator<StreamEvent> {
  const init = { timeout: call.timeoutMs, idleTimeout: call.limits.idleTimeoutMs };
  const data = await postStream(http, config, url, streamBody(config, call), init);
  yield* readStreamEvents(data);
}

function structuredBody(config: OpenRouterConfig, call: StructuredCall): Record<string, unknown> {
  return requestBody(config, call.messages, {
    temperature: UNDERSTAND_TEMPERATURE,
    ...maxTokensField(call.maxTokens),
    response_format: {
      type: 'json_schema',
      json_schema: { name: SEARCH_INTENT_SCHEMA_NAME, strict: true, schema: call.schema },
    },
  });
}

function streamBody(config: OpenRouterConfig, call: StreamCall): Record<string, unknown> {
  return requestBody(config, call.messages, {
    temperature: GENERATE_TEMPERATURE,
    ...maxTokensField(call.limits.maxTokens),
    stream: true,
    stream_options: { include_usage: true },
  });
}

function maxTokensField(maxTokens: number | undefined): Record<string, number> {
  return maxTokens === undefined ? {} : { max_tokens: maxTokens };
}

function requestBody(
  config: OpenRouterConfig,
  messages: ChatMessage[],
  extra: Record<string, unknown>,
): Record<string, unknown> {
  return {
    model: config.model,
    messages,
    provider: { require_parameters: OPENROUTER_REQUIRE_PARAMETERS },
    reasoning: { effort: OPENROUTER_REASONING_EFFORT, exclude: OPENROUTER_EXCLUDE_REASONING },
    ...extra,
  };
}

async function postJson(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const response = await send(http, config, url, body, { timeout: timeoutMs });
  if (response.status !== 200) throw failedStatus(response, 'provider request failed');
  return response.data;
}

async function postStream(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  body: Record<string, unknown>,
  init: { timeout: number; idleTimeout?: number },
): Promise<unknown> {
  const response = await send(http, config, url, body, { ...init, responseType: 'stream' });
  if (response.status !== 200) throw failedStatus(response, 'provider stream failed');
  return response.data;
}

function failedStatus(response: { status: number; headers?: Record<string, unknown> }, message: string): ProviderTransportError {
  return new ProviderTransportError(response.status, message, readRetryAfter(response.headers));
}

async function send(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  body: Record<string, unknown>,
  init: Omit<HttpInit, 'headers'>,
): Promise<{ status: number; data: unknown; headers?: Record<string, unknown> }> {
  try {
    return await http.post(url, body, { headers: { Authorization: `Bearer ${config.apiKey}` }, ...init });
  } catch (error) {
    if (error instanceof ProviderTransportError) throw error;
    throw new ProviderTransportError(null, 'request failed');
  }
}

function chatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}${OPENROUTER_CHAT_COMPLETIONS_PATH}`;
}

function readContent(data: unknown): string {
  const choice = asRecord(firstChoice(data));
  const message = asRecord(choice?.message);
  const content = message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new LlmOutputError('response is not json');
  }
  return content;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function firstChoice(data: unknown): unknown {
  const record = isRecord(data) ? data : null;
  return Array.isArray(record?.choices) ? record.choices[0] : undefined;
}

function readUsage(data: unknown): TokenUsage | null {
  const record = isRecord(data) ? data : null;
  return usageFrom(record?.usage);
}

function usageFrom(value: unknown): TokenUsage | null {
  if (!isRecord(value)) return null;
  return {
    promptTokens: count(value.prompt_tokens),
    completionTokens: count(value.completion_tokens),
    totalTokens: count(value.total_tokens),
  };
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
