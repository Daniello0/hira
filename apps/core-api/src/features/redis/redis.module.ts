import { Global, Inject, Module, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { COUNTER_STORE } from './counter.store';
import { readRedisUrl } from './redis.config';
import { REDIS } from './redis.constants';
import { RedisCounterStore } from './redis-counter.store';

const RECONNECT_STEP_MS = 200;
const RECONNECT_MAX_MS = 2_000;

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

/**
 * The first command waits for the lazy connection. While Redis is away a command fails after one
 * retry, and the client keeps reconnecting, so a Redis restart does not need a core-api restart.
 */
export function createRedisClient(env: NodeJS.ProcessEnv): Redis {
  return new Redis(readRedisUrl(env), {
    lazyConnect: true,
    enableReadyCheck: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (attempt) => Math.min(attempt * RECONNECT_STEP_MS, RECONNECT_MAX_MS),
  });
}

