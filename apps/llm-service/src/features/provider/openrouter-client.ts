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
import { readStreamEvents } from './read-stream-events';
import type { StreamEvent } from './stream-event';

export interface HttpInit {
  headers: Record<string, string>;
  timeout: number;
  responseType?: 'json' | 'stream';
}

export interface HttpPost {
  post(url: string, body: unknown, init: HttpInit): Promise<{ status: number; data: unknown }>;
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
  ): Promise<StructuredResult>;
  streamText(messages: ChatMessage[], timeoutMs: number): AsyncIterable<StreamEvent>;
}

/** OpenRouter chat client. Callers own retries; this function performs one HTTP call. */
export function createOpenRouterClient(http: HttpPost, config: OpenRouterConfig): OpenRouterClient {
  const url = chatCompletionsUrl(config.baseUrl);
  return {
    completeStructured: (messages, schema, timeoutMs) =>
      completeStructured(http, config, url, messages, schema, timeoutMs),
    streamText: (messages, timeoutMs) => streamText(http, config, url, messages, timeoutMs),
  };
}

async function completeStructured(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  timeoutMs: number,
): Promise<StructuredResult> {
  const data = await postJson(http, config, url, structuredBody(config, messages, schema), timeoutMs);
  return { content: readContent(data), tokenUsage: readUsage(data) ?? { ...ZERO_TOKEN_USAGE } };
}

async function* streamText(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  messages: ChatMessage[],
  timeoutMs: number,
): AsyncGenerator<StreamEvent> {
  const data = await postStream(http, config, url, streamBody(config, messages), timeoutMs);
  yield* readStreamEvents(data);
}

function structuredBody(
  config: OpenRouterConfig,
  messages: ChatMessage[],
  schema: Record<string, unknown>,
): Record<string, unknown> {
  return requestBody(config, messages, {
    temperature: UNDERSTAND_TEMPERATURE,
    response_format: {
      type: 'json_schema',
      json_schema: { name: SEARCH_INTENT_SCHEMA_NAME, strict: true, schema },
    },
  });
}

function streamBody(config: OpenRouterConfig, messages: ChatMessage[]): Record<string, unknown> {
  return requestBody(config, messages, {
    temperature: GENERATE_TEMPERATURE,
    stream: true,
    stream_options: { include_usage: true },
  });
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
  const response = await send(http, config, url, body, timeoutMs);
  if (response.status !== 200) throw new ProviderTransportError(response.status, 'provider request failed');
  return response.data;
}

async function postStream(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const response = await send(http, config, url, body, timeoutMs, 'stream');
  if (response.status !== 200) throw new ProviderTransportError(response.status, 'provider stream failed');
  return response.data;
}

async function send(
  http: HttpPost,
  config: OpenRouterConfig,
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  responseType?: 'stream',
): Promise<{ status: number; data: unknown }> {
  try {
    return await http.post(url, body, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      timeout: timeoutMs,
      responseType,
    });
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
