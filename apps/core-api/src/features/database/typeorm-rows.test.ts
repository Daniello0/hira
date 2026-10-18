import { describe, expect, it } from 'vitest';
import { typeormRows } from './typeorm-rows';

describe('typeormRows', () => {
  it('unwraps the update tuple and leaves a select list alone', () => {
    const row = { id: 'call-1', startedAt: '2026-10-18T17:23:10.843Z' };
    expect(typeormRows([[row], 1])).toEqual([row]);
    expect(typeormRows([[], 0])).toEqual([]);
    expect(typeormRows([row])).toEqual([row]);
  });
});
