import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Clock } from '../../common/utils/clock';
import { DEMO_QUOTA_PREFIX } from '../auth/auth.constants';
import { LoginRateLimitService } from '../rate-limit/login-rate-limit.service';
import { SearchQuotaService } from '../rate-limit/search-quota.service';
import { RedisCounterStore } from './redis-counter.store';
import { createRedisClient } from './redis.module';

const exec = promisify(execFile);
const CONTAINER = 'hira-redis-auth-test';
const HOST_PORT = 63798;
const START_TIMEOUT_MS = 120_000;

describe('redis counters', () => {
  let redis: Redis;

  beforeAll(async () => {
    await startRedis();
    redis = new Redis(redisUrl(), {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    await redis.connect();
    await redis.ping();
  }, START_TIMEOUT_MS);

  afterAll(async () => {
    redis?.disconnect();
    await exec('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  });

  it('keeps the first TTL and leaves a demo quota without expiry', async () => {
    const store = new RedisCounterStore(redis);
    expect(await store.increment('quota:test:ttl', 30)).toBe(1);
    expect(await store.increment('quota:test:ttl', 5)).toBe(2);
    expect(await store.ttl('quota:test:ttl')).toBeGreaterThan(5);
    const quota = new SearchQuotaService(store, fixedClock());
    const sessionId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    expect((await quota.consumeDemo(sessionId)).allowed).toBe(true);
    const ttl = await redis.ttl(`${DEMO_QUOTA_PREFIX}${sessionId}`);
    expect(ttl).toBe(-1);
  });

  it('locks the sixth login attempt', async () => {
    const limits = new LoginRateLimitService(new RedisCounterStore(redis));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await limits.consume('203.0.113.9', 'ada@example.com')).toBeNull();
    }
    expect(await limits.consume('203.0.113.9', 'ada@example.com')).toBe(2);
  });

  it('answers the first command on a client that has not connected yet', async () => {
    const client = createRedisClient({ REDIS_URL: redisUrl() });
    try {
      expect(await client.ping()).toBe('PONG');
    } finally {
      client.disconnect();
    }
  });
});

function redisUrl(): string {
  return `redis://127.0.0.1:${HOST_PORT}`;
}

function fixedClock(): Clock {
  return { now: () => new Date('2026-10-11T23:00:00.000Z') };
}

async function startRedis(): Promise<void> {
  await exec('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  await exec('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-p',
    `${HOST_PORT}:6379`,
    'redis:7-alpine',
  ]);
  await waitForPing();
}

async function waitForPing(): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await canPing()) return;
    await delay(200);
  }
  throw new Error('test redis did not answer PING');
}

async function canPing(): Promise<boolean> {
  const probe = new Redis(redisUrl(), {
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  });
  try {
    await probe.connect();
    return (await probe.ping()) === 'PONG';
  } catch {
    return false;
  } finally {
    probe.disconnect();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
