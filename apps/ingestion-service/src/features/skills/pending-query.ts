import type { VacancySource } from '@hira/contracts';
import type { SqlClient } from '../store/sql-client';
import type { PendingSkillVacancy } from './process-skills';

/** Vacancies whose skills have not been extracted. */
export async function listPendingSkills(
  client: SqlClient,
  source: VacancySource,
  limit: number,
): Promise<PendingSkillVacancy[]> {
  const result = await client.query(PENDING_SKILLS, [source, limit]);
  return result.rows.map(readPending);
}

/** Vacancies that already have skills and still need a vector. */
export async function listPendingEmbeddings(
  client: SqlClient,
  source: VacancySource,
  limit: number,
): Promise<PendingSkillVacancy[]> {
  const result = await client.query(PENDING_EMBEDDINGS, [source, limit]);
  return result.rows.map(readPending);
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
  ORDER BY id
  LIMIT $2`;

const PENDING_EMBEDDINGS = `SELECT id::text AS id, external_id AS "externalId", title, description,
  content_hash AS "contentHash"
  FROM vacancies
  WHERE source = $1 AND status = 'ACTIVE' AND skills_extracted_at IS NOT NULL AND embedding IS NULL
  ORDER BY id
  LIMIT $2`;
