import { Inject, Injectable } from '@nestjs/common';
import type Redis from 'ioredis';
import type { CounterStore } from './counter.store';
import { REDIS } from './redis.constants';

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 and ARGV[1] ~= '-1' then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`;

/** `CounterStore` backed by the shared Redis connection. */
@Injectable()
export class RedisCounterStore implements CounterStore {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /** @inheritdoc */
  async increment(key: string, ttlSeconds: number | null): Promise<number> {
    const ttl = ttlSeconds === null ? '-1' : String(ttlSeconds);
    const count = await this.redis.eval(INCREMENT_SCRIPT, 1, key, ttl);
    return Number(count);
  }

  /** @inheritdoc */
  async ttl(key: string): Promise<number | null> {
    const seconds = await this.redis.ttl(key);
    if (seconds < 1) return null;
    return seconds;
  }

  /** @inheritdoc */
  async setExpiring(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, 'EX', ttlSeconds);
  }

  /** @inheritdoc */
  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.redis.del(...keys);
  }
}
