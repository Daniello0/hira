import { describe, expect, it } from 'vitest';
import { isSkillWeight } from './skill-weight';

describe('isSkillWeight', () => {
  it('accepts a finite weight on the closed interval from 0 to 1', () => {
    expect(isSkillWeight(0)).toBe(true);
    expect(isSkillWeight(1)).toBe(true);
    expect(isSkillWeight(0.5)).toBe(true);
  });

  it('rejects weights outside that interval and non-finite numbers', () => {
    expect(isSkillWeight(-0.01)).toBe(false);
    expect(isSkillWeight(1.01)).toBe(false);
    expect(isSkillWeight(Number.NaN)).toBe(false);
    expect(isSkillWeight(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
