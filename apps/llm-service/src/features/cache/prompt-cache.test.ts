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

  it('connects a lazy client before the first command', async () => {
    let open = false;
    const client = {
      status: 'wait',
      async connect() {
        open = true;
        this.status = 'ready';
      },
      async get(key: string) {
        if (!open) throw new Error(`closed ${key}`);
        return 'hit';
      },
      async set() {
        if (!open) throw new Error('closed');
      },
    };
    const cache = createRedisPromptCache(client);
    expect(await cache.get('llm:understand:1')).toBe('hit');
    expect(client.status).toBe('ready');
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
