import { describe, expect, it } from 'vitest';
import { FAVORITES_EMPTY_MESSAGE, FAVORITES_SEARCH_EMPTY_MESSAGE, favoritesEmptyMessage } from './favorites.constants';

describe('favoritesEmptyMessage', () => {
  it('returns null when rows exist', () => {
    expect(favoritesEmptyMessage('', 2)).toBeNull();
    expect(favoritesEmptyMessage('remote', 1)).toBeNull();
  });

  it('distinguishes an empty library from a failed search', () => {
    expect(favoritesEmptyMessage('', 0)).toBe(FAVORITES_EMPTY_MESSAGE);
    expect(favoritesEmptyMessage('  remote  ', 0)).toBe(FAVORITES_SEARCH_EMPTY_MESSAGE);
  });
});
