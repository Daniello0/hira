import type { ChatMessage } from '../provider/chat-message';
import type { TokenUsage, UnderstandRequest, UnderstandResponse } from '@hira/contracts';
import type { Logger } from 'pino';
import { isRecord } from '../../common/utils/is-record';
import { readPromptCache, writePromptCache, type PromptCache } from '../cache/prompt-cache';
import { understandCacheKey } from '../cache/understand-cache-key';
import {
  MAX_TOKENS,
  SEARCH_INTENT_SCHEMA_VERSION,
  UNDERSTAND_ATTEMPT_TIMEOUT_MS,
  UNDERSTAND_CACHE_TTL_SECONDS,
} from '../llm/llm.constants';
import { runLlmAttempts } from '../provider/llm-retry';
import { toRouteError } from '../llm/route-error';
import { buildUnderstandMessages } from './build-understand-messages';
import { asModelOutput } from './read-model-intent';
import { buildSearchIntentJsonSchema } from './search-intent.schema';

export interface UnderstandDeps {
  provider: {
    completeStructured(
      messages: ChatMessage[],
      schema: Record<string, unknown>,
      timeoutMs: number,
      maxTokens?: number,
    ): Promise<{ content: string; tokenUsage: TokenUsage }>;
  };
  cache: PromptCache;
  sleep: (ms: number) => Promise<void>;
  model: string;
  logger: Logger;
  now: () => number;
}

/** Resolves a search intent, using Redis for identical inputs and retrying bad model output. */
export async function understandQuery(
  deps: UnderstandDeps,
  request: UnderstandRequest,
): Promise<UnderstandResponse> {
  const key = understandCacheKey(deps.model, SEARCH_INTENT_SCHEMA_VERSION, request);
  const cached = await readCached(deps, key);
  if (cached !== null) return cached;
  const response = await completeIntent(deps, request);
  await writePromptCache(deps.cache, key, JSON.stringify(response), UNDERSTAND_CACHE_TTL_SECONDS, deps.logger);
  return response;
}

async function readCached(deps: UnderstandDeps, key: string): Promise<UnderstandResponse | null> {
  const raw = await readPromptCache(deps.cache, key, deps.logger);
  if (raw === null) return null;
  return parseCached(raw);
}

function parseCached(raw: string): UnderstandResponse | null {
  try {
    return asResponse(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

async function completeIntent(
  deps: UnderstandDeps,
  request: UnderstandRequest,
): Promise<UnderstandResponse> {
  const startedAtMs = deps.now();
  try {
    return await runLlmAttempts({
      sleep: deps.sleep,
      now: deps.now,
      startedAtMs,
      timeoutCapMs: UNDERSTAND_ATTEMPT_TIMEOUT_MS,
      run: (feedback, timeoutMs) => requestIntent(deps, request, feedback, timeoutMs),
    });
  } catch (error) {
    throw routeOrRethrow(error);
  }
}

async function requestIntent(
  deps: UnderstandDeps,
  request: UnderstandRequest,
  feedback: string | null,
  timeoutMs: number,
): Promise<UnderstandResponse> {
  const completion = await deps.provider.completeStructured(
    withFeedback(buildUnderstandMessages(request), feedback),
    buildSearchIntentJsonSchema(),
    timeoutMs,
    MAX_TOKENS.understand,
  );
  return { intent: asModelOutput(completion.content), meta: { tokenUsage: completion.tokenUsage } };
}

function withFeedback(messages: ChatMessage[], feedback: string | null): ChatMessage[] {
  if (feedback === null) return messages;
  return [...messages, { role: 'user', content: feedback }];
}

function asResponse(value: unknown): UnderstandResponse | null {
  if (!isRecord(value) || !isRecord(value.intent) || !isRecord(value.meta)) return null;
  if (typeof value.intent.rewrittenQuery !== 'string' || !isRecord(value.meta.tokenUsage)) return null;
  return value as unknown as UnderstandResponse;
}

function routeOrRethrow(error: unknown): LlmRoute {
  const route = toRouteError(error);
  if (route === null) throw error;
  return route;
}

type LlmRoute = NonNullable<ReturnType<typeof toRouteError>>;
