import { describe, expect, it } from 'vitest';
import { MemoryCounterStore } from './memory-counter.store';

describe('memory counter store', () => {
  it('increments once per call and keeps the first TTL', async () => {
    const store = new MemoryCounterStore();
    expect(await store.increment('demo', null)).toBe(1);
    expect(await store.increment('demo', 60)).toBe(2);
    expect(await store.ttl('demo')).toBeNull();
  });

  it('reports a TTL for an expiring key and deletes it', async () => {
    const store = new MemoryCounterStore();
    await store.setExpiring('lock', '1', 30);
    expect(await store.ttl('lock')).toBeGreaterThan(0);
    await store.delete('lock');
    expect(await store.ttl('lock')).toBeNull();
  });
});
