import { nextAttemptTimeout } from '../llm/attempt-timeout';
import { MAX_LLM_ATTEMPTS, RETRY_BACKOFF_MS } from '../llm/llm.constants';
import { LlmOutputError, LlmRouteError, ProviderTransportError } from '../llm/llm.errors';

export type LlmFailureKind = 'invalid' | 'transport' | 'fatal';

interface AttemptOptions<T> {
  run: (feedback: string | null, timeoutMs: number) => Promise<T>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  startedAtMs: number;
  timeoutCapMs: number;
  /** Total time new attempts may start in. Defaults to `LLM_BUDGET_MS`. */
  budgetMs?: number;
}

/** 429 is deliberately absent: the free plan is rate limited, and a retry only spends more of it. */
const TRANSIENT_STATUSES = new Set([408, 500, 502, 503, 504]);

/** Classifies a provider or validation failure for the shared attempt budget. */
export function classifyLlmFailure(error: unknown): LlmFailureKind {
  if (error instanceof LlmOutputError) return 'invalid';
  if (error instanceof ProviderTransportError) return transportKind(error.status);
  return 'fatal';
}

/**
 * Runs a provider call, then up to two retries.
 * Invalid JSON feeds the error text into the next prompt. Transport failures keep the prompt.
 * A 429 fails at once and carries the provider's `Retry-After` up.
 */
export async function runLlmAttempts<T>(options: AttemptOptions<T>): Promise<T> {
  let feedback: string | null = null;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_LLM_ATTEMPTS; attempt += 1) {
    const timeoutMs = nextAttemptTimeout(options.startedAtMs, options.now(), options.timeoutCapMs, options.budgetMs);
    if (timeoutMs <= 0) throw lastError ?? deadlineError();
    try {
      return await options.run(feedback, timeoutMs);
    } catch (error) {
      lastError = error;
      feedback = keepFeedback(feedback, error);
      if (stopAttempt(error, attempt)) throw error;
      await options.sleep(backoffFor(attempt));
    }
  }
  throw lastError ?? deadlineError();
}

function transportKind(status: number | null): LlmFailureKind {
  if (status === null || TRANSIENT_STATUSES.has(status)) return 'transport';
  return 'fatal';
}

function keepFeedback(current: string | null, error: unknown): string | null {
  if (error instanceof LlmOutputError) return error.message;
  return current;
}

function stopAttempt(error: unknown, attempt: number): boolean {
  if (error instanceof LlmRouteError) return true;
  return classifyLlmFailure(error) === 'fatal' || attempt >= MAX_LLM_ATTEMPTS;
}

function backoffFor(attempt: number): number {
  return RETRY_BACKOFF_MS[attempt - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
}

function deadlineError(): ProviderTransportError {
  return new ProviderTransportError(null, 'language model deadline exceeded');
}
