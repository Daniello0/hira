import { describe, expect, it } from 'vitest';
import { DEFAULT_REDIS_URL, readRedisUrl } from './redis.config';

describe('redis url', () => {
  it('uses local redis when REDIS_URL is missing or blank', () => {
    expect(readRedisUrl({})).toBe(DEFAULT_REDIS_URL);
    expect(readRedisUrl({ REDIS_URL: '   ' })).toBe(DEFAULT_REDIS_URL);
  });

  it('keeps an explicit url', () => {
    expect(readRedisUrl({ REDIS_URL: 'redis://redis:6379' })).toBe('redis://redis:6379');
  });
});
