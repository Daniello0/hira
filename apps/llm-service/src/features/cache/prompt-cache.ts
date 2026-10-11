import type { Logger } from 'pino';

export interface PromptCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

interface RedisStringClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttlSeconds: number): Promise<unknown>;
}

/** Adapts a Redis client to get/set with a seconds TTL. */
export function createRedisPromptCache(client: RedisStringClient): PromptCache {
  return {
    get: (key) => client.get(key),
    set: async (key, value, ttlSeconds) => {
      await client.set(key, value, 'EX', ttlSeconds);
    },
  };
}

/** Reads a cache entry. A Redis failure is a miss, not a failed request. */
export async function readPromptCache(
  cache: PromptCache,
  key: string,
  logger: Logger,
): Promise<string | null> {
  try {
    return await cache.get(key);
  } catch (error) {
    logger.error({ err: error }, 'llm cache read failed');
    return null;
  }
}

/** Stores a cache entry. A Redis failure leaves the answer already computed. */
export async function writePromptCache(
  cache: PromptCache,
  key: string,
  value: string,
  ttlSeconds: number,
  logger: Logger,
): Promise<void> {
  try {
    await cache.set(key, value, ttlSeconds);
  } catch (error) {
    logger.error({ err: error }, 'llm cache write failed');
  }
}
