import { VacancySource, VacancyStatus } from '@hira/contracts';
import type { AliveVerdict } from '../connectors/check-alive';
import type { SqlClient } from './sql-client';

export interface ActiveVacancy {
  id: string;
  externalId: string;
}

/** Next page of active vacancies for one source, after `afterId`. */
export async function listActiveVacancies(
  client: SqlClient,
  source: VacancySource,
  afterId: string | null,
  limit: number,
): Promise<ActiveVacancy[]> {
  const result = await client.query(
    `SELECT id::text AS id, external_id AS "externalId"
     FROM vacancies
     WHERE source = $1 AND status = 'ACTIVE' AND ($2::uuid IS NULL OR id > $2::uuid)
     ORDER BY id
     LIMIT $3`,
    [source, afterId, limit],
  );
  return result.rows.map(readActive);
}

/** Applies a liveness verdict to one active row. */
export async function applyLiveness(
  client: SqlClient,
  id: string,
  verdict: AliveVerdict,
  seenAt: Date,
): Promise<void> {
  if (verdict === 'open') {
    await client.query(`UPDATE vacancies SET last_seen_at = $2 WHERE id = $1`, [id, seenAt]);
    return;
  }
  const status = verdict === 'archived' ? VacancyStatus.Closed : VacancyStatus.Expired;
  await client.query(`UPDATE vacancies SET status = $2, last_seen_at = $3 WHERE id = $1`, [
    id,
    status,
    seenAt,
  ]);
}

function readActive(row: Record<string, unknown>): ActiveVacancy {
  return { id: String(row.id), externalId: String(row.externalId) };
}
