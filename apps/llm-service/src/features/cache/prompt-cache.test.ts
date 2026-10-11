import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { createRedisPromptCache, readPromptCache, writePromptCache } from './prompt-cache';

describe('redis prompt cache', () => {
  it('reads a string and writes it with an expiry in seconds', async () => {
    const store = new Map<string, string>();
    const client = {
      async get(key: string) {
        return store.get(key) ?? null;
      },
      async set(key: string, value: string, mode: string, ttl: number) {
        expect(mode).toBe('EX');
        expect(ttl).toBe(30);
        store.set(key, value);
        return 'OK';
      },
    };
    const cache = createRedisPromptCache(client);
    await cache.set('llm:understand:abc', '{"ok":true}', 30);
    expect(await cache.get('llm:understand:abc')).toBe('{"ok":true}');
  });
});

describe('prompt cache failures', () => {
  it('treats a failed read as a miss and a failed write as a no-op', async () => {
    const logger = pino({ level: 'silent' });
    const spy = vi.spyOn(logger, 'error');
    const cache = {
      async get(): Promise<string | null> {
        throw new Error('redis down');
      },
      async set(): Promise<void> {
        throw new Error('redis down');
      },
    };
    expect(await readPromptCache(cache, 'key', logger)).toBeNull();
    await writePromptCache(cache, 'key', 'value', 30, logger);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
