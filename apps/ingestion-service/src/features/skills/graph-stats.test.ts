import { describe, expect, it } from 'vitest';
import {
  NPMI_MIN_COOCCURRENCE,
  NPMI_MIN_WEIGHT,
  TYPICALITY_ESSENTIAL,
  TYPICALITY_OPTIONAL,
  normalizedPmi,
  relatedWeight,
  skillIdf,
  occupationTypicality,
} from './graph-stats';

describe('normalized PMI', () => {
  it('is 1 when two skills only occur together and 0 at independence', () => {
    expect(normalizedPmi(4, 4, 4, 20)).toBeCloseTo(1, 5);
    expect(normalizedPmi(2, 4, 10, 20)).toBeCloseTo(0, 5);
  });

  it('keeps a clearly associated pair and drops a weak or rare one', () => {
    expect(NPMI_MIN_WEIGHT).toBe(0.2);
    expect(NPMI_MIN_COOCCURRENCE).toBe(5);
    const strong = relatedWeight(80, 200, 100, 1000);
    expect(strong).toBeCloseTo(normalizedPmi(80, 200, 100, 1000) ?? 0, 5);
    expect(strong).toBeGreaterThan(0.2);
    expect(relatedWeight(25, 200, 100, 1000)).toBeNull();
    expect(relatedWeight(1, 1, 1, 15)).toBeNull();
    expect(relatedWeight(0, 5, 5, 20)).toBeNull();
  });
});

describe('skill IDF', () => {
  it('uses the natural log of corpus size over document frequency', () => {
    expect(skillIdf(100, 1000)).toBeCloseTo(Math.log(10), 5);
    expect(skillIdf(0, 1000)).toBe(0);
    expect(skillIdf(1000, 1000)).toBe(0);
    expect(skillIdf(3, 0)).toBe(0);
  });
});

describe('occupation typicality', () => {
  it('treats an essential skill as fully characteristic and an optional one as half', () => {
    expect(TYPICALITY_ESSENTIAL).toBe(1);
    expect(TYPICALITY_OPTIONAL).toBe(0.5);
    expect(occupationTypicality('essential')).toBe(1);
    expect(occupationTypicality('optional')).toBe(0.5);
    expect(occupationTypicality('unknown')).toBeNull();
  });
});
