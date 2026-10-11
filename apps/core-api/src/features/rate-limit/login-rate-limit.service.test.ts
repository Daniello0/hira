import { describe, expect, it } from 'vitest';
import { MemoryCounterStore } from '../redis/memory-counter.store';
import { LoginRateLimitService } from './login-rate-limit.service';

describe('login rate limit', () => {
  it('locks an email on the sixth attempt even when the IP changes', async () => {
    const limits = new LoginRateLimitService(new MemoryCounterStore());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await limits.consume(`10.0.0.${attempt}`, 'ada@example.com')).toBeNull();
    }
    expect(await limits.consume('10.0.0.9', 'ada@example.com')).toBe(2);
  });

  it('locks an IP on the sixth attempt across emails', async () => {
    const limits = new LoginRateLimitService(new MemoryCounterStore());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await limits.consume('10.0.0.1', `user${attempt}@example.com`)).toBeNull();
    }
    expect(await limits.consume('10.0.0.1', 'other@example.com')).toBe(2);
  });

  it('clears both counters after a successful login', async () => {
    const limits = new LoginRateLimitService(new MemoryCounterStore());
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await limits.consume('10.0.0.1', 'ada@example.com');
    }
    await limits.clear('10.0.0.1', 'ada@example.com');
    expect(await limits.consume('10.0.0.1', 'ada@example.com')).toBeNull();
  });
});
