import Redis from 'ioredis';
import { ENV } from '../../common/constants/app.constants';

const DEFAULT_LLM_REDIS_URL = 'redis://127.0.0.1:6379';

/** Redis for the understand cache. Nothing connects until the first command. */
export function createLlmRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
}

/** Reads `REDIS_URL`. An empty value matches the local Compose default. */
export function readLlmRedisUrl(env: NodeJS.ProcessEnv): string {
  const url = env[ENV.redisUrl]?.trim() ?? '';
  if (url.length === 0) return DEFAULT_LLM_REDIS_URL;
  return url;
}
