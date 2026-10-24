import { describe, expect, it } from 'vitest';
import { nextFavoriteToggle } from './favorite-toggle-state';

describe('favorite toggle', () => {
  it('moves from idle through saving to saved or error', () => {
    expect(nextFavoriteToggle('idle', 'submit')).toBe('saving');
    expect(nextFavoriteToggle('saving', 'saved')).toBe('saved');
    expect(nextFavoriteToggle('saving', 'fail')).toBe('error');
    expect(nextFavoriteToggle('error', 'submit')).toBe('saving');
    expect(nextFavoriteToggle('saving', 'submit')).toBe('saving');
  });
});
