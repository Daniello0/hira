import { describe, expect, it } from 'vitest';
import { MemoryFavoriteStore } from './memory-favorite.store';

describe('MemoryFavoriteStore insertCollection', () => {
  it('keeps one default Saved collection under concurrent insert', async () => {
    const store = new MemoryFavoriteStore();
    const userId = 'user-1';
    const [first, second] = await Promise.all([
      store.insertCollection({ userId, name: 'Saved', description: null, isDefault: true }),
      store.insertCollection({ userId, name: 'Saved', description: null, isDefault: true }),
    ]);
    expect(first.id).toBe(second.id);
    expect(await store.listCollections(userId)).toHaveLength(1);
  });
});
