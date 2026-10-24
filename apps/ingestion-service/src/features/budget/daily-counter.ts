import type { Redis } from 'ioredis';
import { BUDGET_KEY_PREFIX, BUDGET_TTL_SECONDS } from '../ingestion.constants';

/** A per-day counter shared by every ingestion process through Redis. */
export interface DailyCounter {
  /** Counts one use of `key` today; false once today's count is above `limit`. */
  take(key: string, limit: number): Promise<boolean>;
}

/** Redis counter keyed by the UTC day; keys expire after two days. */
export function createRedisDailyCounter(
  redis: Redis,
  now: () => Date = () => new Date(),
): DailyCounter {
  return {
    take: async (key, limit) => {
      if (limit <= 0) return false;
      const dayKey = `${BUDGET_KEY_PREFIX}:${key}:${now().toISOString().slice(0, 10)}`;
      const used = await redis.incr(dayKey);
      if (used === 1) await redis.expire(dayKey, BUDGET_TTL_SECONDS);
      return used <= limit;
    },
  };
}
