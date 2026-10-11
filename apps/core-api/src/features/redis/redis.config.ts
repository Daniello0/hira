import { ENV } from '../../common/constants/app.constants';

/** Used when `REDIS_URL` is empty, matching a Redis published on localhost. */
export const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';

/**
 * URL for the rate-limit client and the readiness probe.
 * An empty value is the local default, so both look at the same Redis.
 */
export function readRedisUrl(env: NodeJS.ProcessEnv): string {
  const url = env[ENV.redisUrl];
  if (url === undefined || url.trim().length === 0) return DEFAULT_REDIS_URL;
  return url;
}
