import { LOGIN_MAX_ATTEMPTS, LOGIN_MAX_BACKOFF_SECONDS } from '../auth/auth.constants';

/**
 * Attempts 1–5 are allowed.
 * The next attempt waits `2^(n-5)` seconds, capped, which is the exponential delay from Wiki/07.
 */
export function retryAfterForAttempt(attemptCount: number): number | null {
  if (attemptCount <= LOGIN_MAX_ATTEMPTS) return null;
  const shift = attemptCount - LOGIN_MAX_ATTEMPTS;
  return Math.min(2 ** shift, LOGIN_MAX_BACKOFF_SECONDS);
}

/** Longest positive wait. `null` when neither side is blocking. */
export function longestWait(left: number | null, right: number | null): number | null {
  const waits = [left, right].filter((value): value is number => value !== null && value > 0);
  if (waits.length === 0) return null;
  return Math.max(...waits);
}
