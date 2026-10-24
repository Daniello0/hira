import type { TokenUsage } from '@hira/contracts';
import { ZodError } from 'zod';
import { LlmOutputError } from './llm.errors';
import { BACKGROUND_ATTEMPT_TIMEOUT_MS, BACKGROUND_BUDGET_MS } from './llm.constants';
import { toRouteError } from './route-error';
import type { ChatMessage } from '../provider/chat-message';
import { runLlmAttempts } from '../provider/llm-retry';

export interface StructuredDeps {
  provider: {
    completeStructured(
      messages: ChatMessage[],
      schema: Record<string, unknown>,
      timeoutMs: number,
      maxTokens?: number,
    ): Promise<{ content: string; tokenUsage: TokenUsage }>;
  };
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

/**
 * One structured call off the chat path (summary, memory, resume). Each attempt may take
 * `BACKGROUND_ATTEMPT_TIMEOUT_MS`; the answer is capped at `maxTokens`.
 */
export async function completeJson<T>(
  deps: StructuredDeps,
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  parse: (value: unknown) => T,
  maxTokens: number,
): Promise<T> {
  const startedAtMs = deps.now();
  try {
    return await runLlmAttempts({
      sleep: deps.sleep,
      now: deps.now,
      startedAtMs,
      timeoutCapMs: BACKGROUND_ATTEMPT_TIMEOUT_MS,
      budgetMs: BACKGROUND_BUDGET_MS,
      run: (feedback, timeoutMs) => once(deps, { messages: withFeedback(messages, feedback), schema, timeoutMs, maxTokens }, parse),
    });
  } catch (error) {
    throw routeOrRethrow(error);
  }
}

interface StructuredCall {
  messages: ChatMessage[];
  schema: Record<string, unknown>;
  timeoutMs: number;
  maxTokens: number;
}

async function once<T>(deps: StructuredDeps, call: StructuredCall, parse: (value: unknown) => T): Promise<T> {
  const completion = await deps.provider.completeStructured(call.messages, call.schema, call.timeoutMs, call.maxTokens);
  return readContent(completion.content, parse);
}

function readContent<T>(content: string, parse: (value: unknown) => T): T {
  try {
    return parse(parseJson(content));
  } catch (error) {
    if (error instanceof LlmOutputError) throw error;
    throw new LlmOutputError(issueText(error));
  }
}

function parseJson(content: string): unknown {
  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new LlmOutputError('response is not json');
  }
}

export function withFeedback(messages: ChatMessage[], feedback: string | null): ChatMessage[] {
  if (feedback === null) return messages;
  return [...messages, { role: 'user', content: feedback }];
}

function issueText(error: unknown): string {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
  }
  if (error instanceof Error) return error.message;
  return 'invalid model output';
}

function routeOrRethrow(error: unknown): NonNullable<ReturnType<typeof toRouteError>> {
  const route = toRouteError(error);
  if (route === null) throw error;
  return route;
}
