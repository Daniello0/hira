import type { SkillImportance } from '@hira/contracts';
import type { SqlClient } from '../store/sql-client';
import { conditionsText, contentHash } from '../normalize/content-hash';
import { quoteFromDescription } from './quote-span';
import { joinSkillNames } from './skill-names';
import { isSkillWeight } from './skill-weight';

export interface VacancySkillWrite {
  skillId: number;
  importance: SkillImportance;
  weight: number;
  evidenceSpan: string | null;
}

/** Replaces a vacancy's skills, refreshes the hash, and clears the stale vector. */
export async function writeVacancySkills(
  client: SqlClient,
  vacancyId: string,
  skills: readonly VacancySkillWrite[],
  extractedAt: Date,
): Promise<void> {
  if (!skills.every((skill) => isSkillWeight(skill.weight))) {
    throw new Error('skill weight is outside 0..1');
  }
  await client.query('BEGIN');
  try {
    await replaceSkills(client, vacancyId, skills, extractedAt);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function replaceSkills(
  client: SqlClient,
  vacancyId: string,
  skills: readonly VacancySkillWrite[],
  extractedAt: Date,
): Promise<void> {
  const vacancy = await loadVacancy(client, vacancyId);
  const names = await loadNames(
    client,
    skills.map((skill) => skill.skillId),
  );
  const skillsText = joinSkillNames(names);
  await client.query(`DELETE FROM vacancy_skills WHERE vacancy_id = $1`, [vacancyId]);
  for (const skill of skills) await insertSkill(client, vacancyId, vacancy.description, skill);
  await client.query(UPDATE_SKILLS, [
    vacancyId,
    skillsText,
    contentHash({
      title: vacancy.title,
      description: vacancy.description,
      skillsText,
      conditions: conditionsText(vacancy.workFormat, vacancy.schedule),
    }),
    extractedAt,
  ]);
}

async function insertSkill(
  client: SqlClient,
  vacancyId: string,
  description: string,
  skill: VacancySkillWrite,
): Promise<void> {
  await client.query(
    `INSERT INTO vacancy_skills (vacancy_id, skill_id, importance, weight, evidence_span)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      vacancyId,
      skill.skillId,
      skill.importance,
      skill.weight,
      quoteFromDescription(description, skill.evidenceSpan),
    ],
  );
}

async function loadVacancy(client: SqlClient, vacancyId: string): Promise<VacancyText> {
  const result = await client.query(
    `SELECT title, description, work_format AS "workFormat", schedule
     FROM vacancies WHERE id = $1`,
    [vacancyId],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('vacancy not found');
  return {
    title: String(row.title),
    description: String(row.description ?? ''),
    workFormat: row.workFormat == null ? null : String(row.workFormat),
    schedule: row.schedule == null ? null : String(row.schedule),
  };
}

async function loadNames(client: SqlClient, skillIds: readonly number[]): Promise<string[]> {
  if (skillIds.length === 0) return [];
  const result = await client.query(`SELECT canonical_name FROM skills WHERE id = ANY($1::int[])`, [
    skillIds,
  ]);
  return result.rows.map((row) => String(row.canonical_name));
}

interface VacancyText {
  title: string;
  description: string;
  workFormat: string | null;
  schedule: string | null;
}

const UPDATE_SKILLS = `UPDATE vacancies SET
  skills_text = $2, content_hash = $3, skills_extracted_at = $4, embedding = NULL
  WHERE id = $1`;
