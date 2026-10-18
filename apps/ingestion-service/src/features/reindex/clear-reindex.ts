import type { ReindexScope } from '@hira/contracts';
import type { SqlClient } from '../store/sql-client';
import { reindexClears } from './reindex-scope';

/** Clears vacancy embed marks. Skill taxonomy rows are left in place. */
export async function clearReindex(
  client: SqlClient,
  scope: ReindexScope,
  vacancyIds?: readonly string[],
): Promise<number> {
  const clears = reindexClears(scope);
  const ids = vacancyIds === undefined || vacancyIds.length === 0 ? null : [...vacancyIds];
  const assignments = clears.skillsExtractedAt
    ? 'embedding = NULL, skills_extracted_at = NULL'
    : 'embedding = NULL';
  const result = await client.query(
    `UPDATE vacancies SET ${assignments} WHERE ($1::uuid[] IS NULL OR id = ANY($1::uuid[]))`,
    [ids],
  );
  if (clears.embedding) await deleteChunks(client, ids);
  return result.rowCount ?? 0;
}

async function deleteChunks(client: SqlClient, ids: string[] | null): Promise<void> {
  await client.query(
    `DELETE FROM vacancy_chunks WHERE ($1::uuid[] IS NULL OR vacancy_id = ANY($1::uuid[]))`,
    [ids],
  );
}
