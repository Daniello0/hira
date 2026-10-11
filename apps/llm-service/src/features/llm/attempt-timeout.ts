import { LLM_BUDGET_MS } from './llm.constants';

/**
 * Caps one provider call so retries still finish inside the core-api budget.
 * Zero means the deadline is already spent and the caller must stop.
 */
export function nextAttemptTimeout(startedAtMs: number, nowMs: number, capMs: number): number {
  const remaining = LLM_BUDGET_MS - (nowMs - startedAtMs);
  if (remaining <= 0) return 0;
  return Math.min(capMs, remaining);
}
