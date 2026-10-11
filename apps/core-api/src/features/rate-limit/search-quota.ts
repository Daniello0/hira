import {
  DEMO_SEARCH_LIMIT,
  REGISTERED_SEARCH_LIMIT,
  USER_QUOTA_PREFIX,
} from '../auth/auth.constants';

export interface QuotaConsumption {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number | null;
}

/** Whole seconds until the next UTC midnight. The registered quota resets then. */
export function secondsUntilUtcMidnight(now: Date): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

/** `YYYY-MM-DD` in UTC, so a leftover Redis key cannot bleed into the next day. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Redis key for one user's searches on one UTC day. */
export function userQuotaKey(userId: string, now: Date): string {
  return `${USER_QUOTA_PREFIX}${userId}:${utcDay(now)}`;
}

/** Turns a counter value into an allow or deny. `retryAfterSeconds` is ignored while the call is allowed. */
export function decideQuota(
  count: number,
  limit: number,
  retryAfterSeconds: number | null,
): QuotaConsumption {
  if (count <= limit) {
    return { allowed: true, remaining: limit - count, retryAfterSeconds: null };
  }
  return { allowed: false, remaining: 0, retryAfterSeconds };
}

export { DEMO_SEARCH_LIMIT, REGISTERED_SEARCH_LIMIT };
