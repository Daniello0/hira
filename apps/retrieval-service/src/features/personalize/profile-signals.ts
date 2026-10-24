import type { EmploymentType, SeniorityLevel, VacancyDto, WorkFormat } from '@hira/contracts';
import { PERSONALIZATION_MAX_SHIFT } from './personalize.constants';

/** What S5 knows about the seeker. Empty lists and nulls mean "not stated". */
export interface SeekerProfile {
  skillIds: ReadonlySet<number>;
  seniority: SeniorityLevel | null;
  workFormats: readonly WorkFormat[];
  employment: readonly EmploymentType[];
  salaryMinByn: number | null;
}

/** The profile plus the required and preferred skills of each candidate vacancy. */
export interface PersonalContext {
  profile: SeekerProfile;
  vacancySkills: ReadonlyMap<string, readonly number[]>;
}

/** Profile fit of one vacancy. A null signal has nothing to compare. */
export interface ProfileSignals {
  skillOverlap: number | null;
  seniorityMatch: boolean | null;
  formatMatch: boolean | null;
  salaryMatch: boolean | null;
}

/** Compares one vacancy with the profile, signal by signal. */
export function profileSignals(
  profile: SeekerProfile,
  vacancy: VacancyDto,
  vacancySkillIds: readonly number[],
): ProfileSignals {
  return {
    skillOverlap: skillOverlap(profile.skillIds, vacancySkillIds),
    seniorityMatch: sameOrNull(profile.seniority, vacancy.seniority),
    formatMatch: formatMatch(profile, vacancy),
    salaryMatch: salaryMatch(profile.salaryMinByn, vacancy),
  };
}

/** Score shift in [-15 %, +15 %]: the mean of the known signals mapped from 0..1. */
export function personalShift(signals: ProfileSignals): number {
  const known = [
    signals.skillOverlap,
    asShare(signals.seniorityMatch),
    asShare(signals.formatMatch),
    asShare(signals.salaryMatch),
  ].filter((value): value is number => value !== null);
  if (known.length === 0) return 0;
  const mean = known.reduce((sum, value) => sum + value, 0) / known.length;
  return (2 * mean - 1) * PERSONALIZATION_MAX_SHIFT;
}

function skillOverlap(owned: ReadonlySet<number>, wanted: readonly number[]): number | null {
  if (owned.size === 0 || wanted.length === 0) return null;
  return wanted.filter((skillId) => owned.has(skillId)).length / wanted.length;
}

function formatMatch(profile: SeekerProfile, vacancy: VacancyDto): boolean | null {
  const checks = [
    listMatch(profile.workFormats, vacancy.workFormat),
    listMatch(profile.employment, vacancy.employment),
  ].filter((value): value is boolean => value !== null);
  return checks.length === 0 ? null : checks.every(Boolean);
}

function listMatch<T>(preferred: readonly T[], actual: T | null): boolean | null {
  if (preferred.length === 0 || actual === null) return null;
  return preferred.includes(actual);
}

function salaryMatch(expected: number | null, vacancy: VacancyDto): boolean | null {
  const offered = vacancy.salaryMaxByn ?? vacancy.salaryMinByn;
  if (expected === null || offered === null) return null;
  return offered >= expected;
}

function sameOrNull<T>(left: T | null, right: T | null): boolean | null {
  if (left === null || right === null) return null;
  return left === right;
}

function asShare(value: boolean | null): number | null {
  if (value === null) return null;
  return value ? 1 : 0;
}
