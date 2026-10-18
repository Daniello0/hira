import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Clock } from '../../common/utils/clock';
import { MemoryCounterStore } from '../redis/memory-counter.store';
import { SearchQuotaService } from './search-quota.service';
import { secondsUntilUtcMidnight } from './search-quota';

const NOW = new Date('2026-10-11T23:00:00.000Z');

describe('search quota', () => {
  it('counts seconds until the next UTC midnight', () => {
    expect(secondsUntilUtcMidnight(NOW)).toBe(3600);
    expect(secondsUntilUtcMidnight(new Date('2026-10-11T00:00:00.000Z'))).toBe(86400);
  });

  it('allows three demo searches and then denies without a reset', async () => {
    const quota = new SearchQuotaService(new MemoryCounterStore(), fixedClock());
    const sessionId = randomUUID();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await quota.consumeDemo(sessionId)).allowed).toBe(true);
    }
    expect(await quota.consumeDemo(sessionId)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: null,
    });
  });

  it('reads a missing registered quota as zero without a second increment', async () => {
    const quota = new SearchQuotaService(new MemoryCounterStore(), fixedClock());
    const userId = randomUUID();
    expect(await quota.readRegistered(userId)).toEqual({ used: 0, limit: 20 });
    await quota.consumeRegistered(userId);
    expect(await quota.readRegistered(userId)).toEqual({ used: 1, limit: 20 });
  });

  it('allows twenty registered searches per UTC day', async () => {
    const quota = new SearchQuotaService(new MemoryCounterStore(), fixedClock());
    const userId = randomUUID();
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await quota.consumeRegistered(userId)).remaining).toBe(19 - attempt);
    }
    expect(await quota.consumeRegistered(userId)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 3600,
    });
  });
});

function fixedClock(): Clock {
  return { now: () => NOW };
}
