import { describe, expect, it } from 'vitest';
import { SIMHASH_MAX_DISTANCE } from '../ingestion.constants';
import { descriptionsMatch, hammingDistance, simhash } from './simhash';

describe('simhash', () => {
  it('treats the same description as a match and a different one as not', () => {
    const left = simhash('пишем api на typescript и postgres');
    const right = simhash('пишем api на typescript и postgres');
    const other = simhash('тракторист котельная смена двенадцать часов');
    expect(left).toMatch(/^[0-9a-f]{16}$/);
    expect(hammingDistance(left, right)).toBe(0);
    expect(descriptionsMatch(left, right)).toBe(true);
    expect(hammingDistance(left, other)).toBeGreaterThan(SIMHASH_MAX_DISTANCE);
    expect(descriptionsMatch(left, other)).toBe(false);
  });

  it('rejects a hash of the wrong length', () => {
    expect(() => hammingDistance('abc', 'def')).toThrow(/hash/i);
  });
});
