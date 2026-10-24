import {
  SkillImportance,
  type EmploymentType,
  type SeniorityLevel,
  type WorkFormat,
} from '@hira/contracts';
import { loadProfile, loadVacancySkills } from '../explain/explain-skills';
import type { SqlClient } from '../search/sql-client';
import { PROFILE_SALARY_CURRENCY } from './personalize.constants';
import type { PersonalContext, SeekerProfile } from './profile-signals';

const PROFILE_SQL = `SELECT seniority, preferred_work_format::text[] AS "workFormats",
    preferred_employment::text[] AS employment, salary_expectation_min AS "salaryMin", currency
  FROM user_profiles WHERE user_id = $1`;

/** Profile and the required/preferred skills of the candidates. A user without a profile row has an empty one. */
export async function loadPersonalContext(
  client: SqlClient,
  userId: string,
  vacancyIds: readonly string[],
): Promise<PersonalContext> {
  const profile = await loadSeekerProfile(client, userId);
  const grouped = await loadVacancySkills(client, vacancyIds);
  const vacancySkills = new Map<string, number[]>();
  for (const [vacancyId, rows] of grouped)
    vacancySkills.set(
      vacancyId,
      rows.filter((row) => counted(row.importance)).map((row) => row.skillId),
    );
  return { profile, vacancySkills };
}

/** Reads `user_profiles` and `user_profile_skills` for one user. */
export async function loadSeekerProfile(client: SqlClient, userId: string): Promise<SeekerProfile> {
  const skillIds = (await loadProfile(client, userId)) ?? new Set<number>();
  const result = await client.query(PROFILE_SQL, [userId]);
  const row = result.rows[0];
  if (row === undefined) return emptyProfile(skillIds);
  return {
    skillIds,
    seniority: (row.seniority ?? null) as SeniorityLevel | null,
    workFormats: (row.workFormats ?? []) as WorkFormat[],
    employment: (row.employment ?? []) as EmploymentType[],
    salaryMinByn: salaryInByn(row.salaryMin, row.currency),
  };
}

function counted(importance: SkillImportance): boolean {
  return importance === SkillImportance.Required || importance === SkillImportance.Preferred;
}

function salaryInByn(amount: unknown, currency: unknown): number | null {
  if (amount === null || amount === undefined) return null;
  const code = typeof currency === 'string' ? currency.trim().toUpperCase() : '';
  if (code.length > 0 && code !== PROFILE_SALARY_CURRENCY) return null;
  const value = Number(amount);
  return Number.isFinite(value) ? value : null;
}

function emptyProfile(skillIds: ReadonlySet<number>): SeekerProfile {
  return { skillIds, seniority: null, workFormats: [], employment: [], salaryMinByn: null };
}
