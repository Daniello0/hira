import type { VacancySource } from '@hira/contracts';
import { SKILL_MAX_FAILURES } from '../ingestion.constants';
import type { SqlClient } from '../store/sql-client';
import type { PendingSkillVacancy } from './process-skills';

/** Vacancies whose skills have not been extracted and that failed fewer than three times. */
export async function listPendingSkills(
  client: SqlClient,
  source: VacancySource,
  limit: number,
): Promise<PendingSkillVacancy[]> {
  const result = await client.query(PENDING_SKILLS, [source, limit, SKILL_MAX_FAILURES]);
  return result.rows.map(readPending);
}

/** Vacancies that still need a vector. Embedding does not wait for skill extraction. */
export async function listPendingEmbeddings(
  client: SqlClient,
  source: VacancySource,
  limit: number,
): Promise<PendingSkillVacancy[]> {
  const result = await client.query(PENDING_EMBEDDINGS, [source, limit]);
  return result.rows.map(readPending);
}

/** Counts one failed extraction; at `SKILL_MAX_FAILURES` the vacancy is no longer claimed. */
export async function recordSkillFailure(client: SqlClient, vacancyId: string): Promise<void> {
  await client.query(
    `UPDATE vacancies SET skill_extract_failures = skill_extract_failures + 1 WHERE id = $1`,
    [vacancyId],
  );
}

/**
 * Session advisory lock for one job kind and source, so a manual run and a cron tick never
 * extract the same vacancies twice. Returns false when another run holds it.
 */
export async function tryLockJob(client: SqlClient, key: string): Promise<boolean> {
  const result = await client.query(`SELECT pg_try_advisory_lock(hashtext($1)) AS locked`, [key]);
  return result.rows[0]?.locked === true;
}

/** Releases the lock taken by `tryLockJob` on the same connection. */
export async function unlockJob(client: SqlClient, key: string): Promise<void> {
  await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [key]);
}

function readPending(row: Record<string, unknown>): PendingSkillVacancy {
  return {
    id: String(row.id),
    externalId: String(row.externalId),
    title: String(row.title),
    description: String(row.description ?? ''),
    contentHash: String(row.contentHash ?? ''),
  };
}

const PENDING_SKILLS = `SELECT id::text AS id, external_id AS "externalId", title, description,
  content_hash AS "contentHash"
  FROM vacancies
  WHERE source = $1 AND status = 'ACTIVE' AND skills_extracted_at IS NULL
    AND skill_extract_failures < $3
  ORDER BY id
  LIMIT $2`;

const PENDING_EMBEDDINGS = `SELECT id::text AS id, external_id AS "externalId", title, description,
  content_hash AS "contentHash"
  FROM vacancies
  WHERE source = $1 AND status = 'ACTIVE' AND embedding IS NULL
  ORDER BY id
  LIMIT $2`;
