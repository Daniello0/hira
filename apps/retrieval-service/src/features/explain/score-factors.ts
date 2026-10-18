import type { MatchExplanation, SeniorityLevel } from '@hira/contracts';

/** Inputs of the six explanation factors. Missing branch data is null. */
export interface FactorInput {
  graphRan: boolean;
  coverage: number | null;
  denseDistance: number | null;
  lexicalRank: number | null;
  querySeniority: SeniorityLevel | null;
  vacancySeniority: SeniorityLevel | null;
  workFormatAsked: boolean;
  employmentAsked: boolean;
  salaryAsked: boolean;
}

/** Factor scores and their average. Both live on 0..100. */
export interface FactorBreakdown {
  totalScore: number;
  factors: MatchExplanation['factors'];
}

/**
 * Averages the six factors. The average does not order the list.
 * Stub returns zeros.
 */
export function scoreFactors(_input: FactorInput): FactorBreakdown {
  const zero = { score: 0 };
  return {
    totalScore: 0,
    factors: {
      skillFit: zero,
      semanticFit: zero,
      lexicalFit: zero,
      experienceFit: zero,
      formatFit: zero,
      salaryFit: zero,
    },
  };
}
