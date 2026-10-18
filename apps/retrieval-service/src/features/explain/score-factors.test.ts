import { SeniorityLevel } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { scoreFactors, type FactorInput } from './score-factors';

function input(patch: Partial<FactorInput> = {}): FactorInput {
  return {
    graphRan: false,
    coverage: null,
    denseDistance: null,
    lexicalRank: null,
    querySeniority: null,
    vacancySeniority: null,
    workFormatAsked: false,
    employmentAsked: false,
    salaryAsked: false,
    ...patch,
  };
}

describe('scoreFactors', () => {
  it('returns the same factors for the same input, each inside 0..100', () => {
    const factors = scoreFactors(input({ graphRan: true, coverage: 0.5, lexicalRank: 1 }));
    expect(factors.factors.skillFit.score).toBe(50);
    expect(factors.factors.lexicalFit.score).toBe(100);
    expect(scoreFactors(input({ graphRan: true, coverage: 0.5, lexicalRank: 1 }))).toEqual(factors);
    for (const factor of Object.values(factors.factors)) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
    }
  });

  it('averages six factors and leaves a missing branch at zero', () => {
    const scored = scoreFactors(
      input({
        graphRan: true,
        coverage: 1,
        denseDistance: 0,
        lexicalRank: 1,
        querySeniority: SeniorityLevel.Junior,
        vacancySeniority: SeniorityLevel.Junior,
        workFormatAsked: true,
        salaryAsked: true,
      }),
    );
    expect(scored.factors.skillFit.score).toBe(100);
    expect(scored.factors.semanticFit.score).toBe(100);
    expect(scored.factors.lexicalFit.score).toBe(100);
    expect(scored.factors.experienceFit.score).toBe(100);
    expect(scored.factors.formatFit.score).toBe(100);
    expect(scored.factors.salaryFit.score).toBe(100);
    expect(scored.totalScore).toBe(100);
    const missed = scoreFactors(input({ coverage: 1, denseDistance: 2, lexicalRank: 100 }));
    expect(missed.factors.skillFit.score).toBe(0);
    expect(missed.factors.semanticFit.score).toBe(0);
    expect(missed.factors.lexicalFit.score).toBe(1);
    expect(missed.factors.experienceFit.score).toBe(0);
    expect(missed.totalScore).toBeCloseTo(1 / 6);
  });
});
