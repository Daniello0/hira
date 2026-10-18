import { describe, expect, it } from 'vitest';
import { formatLocationLabel } from './location-label';

describe('formatLocationLabel', () => {
  it('joins a city and a region', () => {
    expect(formatLocationLabel('Minsk', 'Minsk Region')).toBe('Minsk, Minsk Region');
  });

  it('keeps a single piece and drops blanks', () => {
    expect(formatLocationLabel('Grodno', '  ')).toBe('Grodno');
    expect(formatLocationLabel(null, null)).toBeNull();
  });
});
