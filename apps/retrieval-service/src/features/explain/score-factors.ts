import type { MatchExplanation, SeniorityLevel } from '@hira/contracts';
import type { ProfileSignals } from '../personalize/profile-signals';

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
  /** S5 profile fit. Fills a factor the query left open; absent when personalization is off. */
  profile?: ProfileSignals | null;
}

/** Factor scores and their average. Both live on 0..100. */
export interface FactorBreakdown {
  totalScore: number;
  factors: MatchExplanation['factors'];
}

const FACTOR_COUNT = 6;

/** Averages the six factors. The average does not order the list. */
export function scoreFactors(input: FactorInput): FactorBreakdown {
  const factors = {
    skillFit: { score: skillFit(input) },
    semanticFit: { score: semanticFit(input) },
    lexicalFit: { score: lexicalFit(input) },
    experienceFit: { score: experienceFit(input) },
    formatFit: { score: formatFit(input) },
    salaryFit: { score: salaryFit(input) },
  };
  const totalScore =
    Object.values(factors).reduce((sum, factor) => sum + factor.score, 0) / FACTOR_COUNT;
  return { totalScore, factors };
}

function skillFit(input: FactorInput): number {
  if (input.graphRan && input.coverage !== null) return clamp(input.coverage * 100);
  const overlap = input.profile?.skillOverlap ?? null;
  return overlap === null ? 0 : clamp(overlap * 100);
}

function semanticFit(input: FactorInput): number {
  if (input.denseDistance === null) return 0;
  return clamp((1 - input.denseDistance) * 100);
}

function lexicalFit(input: FactorInput): number {
  if (input.lexicalRank === null) return 0;
  return clamp(101 - input.lexicalRank);
}

function experienceFit(input: FactorInput): number {
  if (input.querySeniority === null) return input.profile?.seniorityMatch === true ? 100 : 0;
  if (input.vacancySeniority === null) return 0;
  return input.querySeniority === input.vacancySeniority ? 100 : 0;
}

function formatFit(input: FactorInput): number {
  if (input.workFormatAsked || input.employmentAsked) return 100;
  return input.profile?.formatMatch === true ? 100 : 0;
}

function salaryFit(input: FactorInput): number {
  if (input.salaryAsked) return 100;
  return input.profile?.salaryMatch === true ? 100 : 0;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
