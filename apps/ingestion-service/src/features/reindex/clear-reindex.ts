import type { ReindexScope } from '@hira/contracts';
import type { SqlClient } from '../store/sql-client';
import { reindexClears } from './reindex-scope';

interface HeldConnection extends SqlClient {
  release(): void;
}

interface QueryPool extends SqlClient {
  totalCount: number;
  connect(): Promise<HeldConnection>;
}

/** Clears vacancy embed marks. Skill taxonomy rows are left in place. */
export async function clearReindex(
  client: SqlClient,
  scope: ReindexScope,
  vacancyIds?: readonly string[],
): Promise<number> {
  const pool = asPool(client);
  if (pool === null) return inTransaction(client, () => applyClear(client, scope, vacancyIds));
  const held = await pool.connect();
  try {
    return await inTransaction(held, () => applyClear(held, scope, vacancyIds));
  } finally {
    held.release();
  }
}

async function inTransaction(client: SqlClient, run: () => Promise<number>): Promise<number> {
  await client.query('BEGIN');
  try {
    const count = await run();
    await client.query('COMMIT');
    return count;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function applyClear(
  client: SqlClient,
  scope: ReindexScope,
  vacancyIds: readonly string[] | undefined,
): Promise<number> {
  const clears = reindexClears(scope);
  const ids = vacancyIds === undefined || vacancyIds.length === 0 ? null : [...vacancyIds];
  const result = await client.query(updateSql(clears.skillsExtractedAt), [ids]);
  if (clears.embedding) await deleteChunks(client, ids);
  return result.rowCount ?? 0;
}

function updateSql(clearSkills: boolean): string {
  const assignments = clearSkills
    ? 'embedding = NULL, skills_extracted_at = NULL'
    : 'embedding = NULL';
  return `UPDATE vacancies SET ${assignments} WHERE ($1::uuid[] IS NULL OR id = ANY($1::uuid[]))`;
}

async function deleteChunks(client: SqlClient, ids: string[] | null): Promise<void> {
  await client.query(
    `DELETE FROM vacancy_chunks WHERE ($1::uuid[] IS NULL OR vacancy_id = ANY($1::uuid[]))`,
    [ids],
  );
}

function asPool(client: SqlClient): QueryPool | null {
  const candidate = client as SqlClient & { totalCount?: unknown; connect?: unknown };
  if (typeof candidate.totalCount !== 'number' || typeof candidate.connect !== 'function')
    return null;
  return candidate as QueryPool;
}
