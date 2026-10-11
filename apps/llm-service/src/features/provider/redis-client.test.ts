import { describe, expect, it } from 'vitest';
import { createLlmRedisClient } from './redis-client';

describe('createLlmRedisClient', () => {
  it('does not connect or queue commands until the cache is used', () => {
    const client = createLlmRedisClient('redis://127.0.0.1:6399');
    expect(client.options.lazyConnect).toBe(true);
    expect(client.options.enableOfflineQueue).toBe(false);
    expect(client.options.enableReadyCheck).toBe(false);
    expect(client.options.maxRetriesPerRequest).toBe(1);
    expect(client.options.retryStrategy?.(0)).toBeNull();
    client.disconnect();
  });
});
