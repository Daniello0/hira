import { MatchFactor, VacancyStatus, type MatchExplanation, type SkillMatch, type VacancyDto, type VacancyResult } from '@hira/contracts';
import { rateUnitLabel, workFormatLabel } from '../../common/utils/enum-labels';
import { CARD_SKILL_BADGE_LIMIT, SALARY_NOT_LISTED } from './vacancy.constants';

export interface VacancyCardModel {
  title: string;
  company: string;
  location: string;
  pay: string;
  format: string | null;
  score: number;
  badges: string[];
  closed: boolean;
  originalUrl: string;
  foreignRemote: boolean;
}

export interface FactorBar {
  factor: MatchFactor;
  label: string;
  width: number;
}

export interface SkillRow {
  surface: string;
  path: string | null;
  evidence: string | null;
}

export interface SkillGroup {
  title: string;
  skills: SkillRow[];
}

const FACTOR_LABELS: Record<MatchFactor, string> = {
  [MatchFactor.SkillFit]: 'Skill fit',
  [MatchFactor.SemanticFit]: 'Semantic',
  [MatchFactor.LexicalFit]: 'Lexical',
  [MatchFactor.ExperienceFit]: 'Experience',
  [MatchFactor.FormatFit]: 'Format',
  [MatchFactor.SalaryFit]: 'Salary',
};

/** Collapsed card. An empty company stays empty. */
export function toVacancyCardModel(result: VacancyResult): VacancyCardModel {
  return {
    title: result.vacancy.title,
    company: result.vacancy.companyName ?? '',
    location: result.vacancy.locationLabel ?? '',
    pay: payLabel(result.vacancy),
    format: result.vacancy.workFormat === null ? null : workFormatLabel(result.vacancy.workFormat),
    score: Math.round(result.score),
    badges: result.explanation.matchedSkills.slice(0, CARD_SKILL_BADGE_LIMIT).map((skill) => skill.surface),
    closed: result.vacancy.status !== VacancyStatus.Active,
    originalUrl: result.vacancy.url,
    foreignRemote: result.vacancy.isForeignRemote === true,
  };
}

/** Six bars. Width is the factor score clamped to 0..100. */
export function factorBars(explanation: MatchExplanation): FactorBar[] {
  return (Object.values(MatchFactor) as MatchFactor[]).map((factor) => ({
    factor,
    label: FACTOR_LABELS[factor],
    width: width(scoreOf(explanation, factor)),
  }));
}

/** Direct matches, graph matches, and gaps. */
export function skillGroups(explanation: MatchExplanation): SkillGroup[] {
  return [
    { title: 'Matched', skills: rows(explanation.matchedSkills) },
    { title: 'Related through the graph', skills: rows(explanation.relatedSkills) },
    { title: 'Missing', skills: rows(explanation.missingSkills) },
  ];
}

/** Salary, rate, or the "not listed" line. Shared by the card and the detail drawer. */
export function payLabel(vacancy: VacancyDto): string {
  if (vacancy.salaryMin !== null || vacancy.salaryMax !== null) return range(vacancy.salaryMin, vacancy.salaryMax, vacancy.salaryCurrency);
  if (vacancy.rateAmount !== null) return `${vacancy.rateAmount} ${vacancy.rateUnit === null ? '' : rateUnitLabel(vacancy.rateUnit)}`.trim();
  return SALARY_NOT_LISTED;
}

function range(min: number | null, max: number | null, currency: string | null): string {
  const span = min !== null && max !== null ? `${min}–${max}` : String(min ?? max);
  return `${span} ${currency ?? ''}`.trim();
}

function rows(skills: readonly SkillMatch[]): SkillRow[] {
  return skills.map((skill) => ({ surface: skill.surface, path: skill.path, evidence: skill.evidenceSpan }));
}

function scoreOf(explanation: MatchExplanation, factor: MatchFactor): number {
  if (factor === MatchFactor.SkillFit) return explanation.factors.skillFit.score;
  if (factor === MatchFactor.SemanticFit) return explanation.factors.semanticFit.score;
  if (factor === MatchFactor.LexicalFit) return explanation.factors.lexicalFit.score;
  if (factor === MatchFactor.ExperienceFit) return explanation.factors.experienceFit.score;
  if (factor === MatchFactor.FormatFit) return explanation.factors.formatFit.score;
  return explanation.factors.salaryFit.score;
}

function width(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, score));
}
