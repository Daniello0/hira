import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ENV } from '../../common/constants/app.constants';
import { COUNTER_STORE } from './counter.store';
import { REDIS } from './redis.constants';
import { RedisCounterStore } from './redis-counter.store';

const FALLBACK_REDIS_URL = 'redis://127.0.0.1:6379';

/** Closes the client when the Nest process stops, including clients that never connected. */
class RedisLifecycle implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** Drops sockets and timers so tests can exit. */
  onModuleDestroy(): void {
    this.redis.disconnect();
  }
}

/** One lazy client for rate limits. Nothing connects until the first command. */
@Global()
@Module({
  providers: [
    { provide: REDIS, useFactory: (): Redis => createRedisClient(process.env) },
    RedisCounterStore,
    { provide: COUNTER_STORE, useExisting: RedisCounterStore },
    RedisLifecycle,
  ],
  exports: [COUNTER_STORE, REDIS],
})
export class RedisModule {}

function createRedisClient(env: NodeJS.ProcessEnv): Redis {
  return new Redis(readRedisUrl(env), {
    lazyConnect: true,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });
}

function readRedisUrl(env: NodeJS.ProcessEnv): string {
  const url = env[ENV.redisUrl];
  if (url === undefined || url.trim().length === 0) return FALLBACK_REDIS_URL;
  return url;
}
