import type { VacancyDto } from '@hira/contracts';
import { inTransaction } from '../search/in-transaction';
import { loadVacancies } from '../search/load-vacancy';
import type { SqlClient } from '../search/sql-client';

const SOURCE_SQL = 'SELECT embedding::text AS embedding FROM vacancies WHERE id = $1';

/**
 * HNSW over `vacancies.embedding` (idx_vac_emb_hnsw). Iterative scan keeps the page full
 * after the status and duplicate filters; the materialized CTE restores exact distance order.
 */
const NEIGHBOURS_SQL = `WITH nearest AS MATERIALIZED (
    SELECT v.id, v.embedding <=> $1::vector AS distance
    FROM vacancies v
    WHERE v.embedding IS NOT NULL AND v.status = 'ACTIVE' AND v.id <> $2
      AND NOT EXISTS (
        SELECT 1 FROM vacancy_duplicates d
        WHERE (d.canonical_vacancy_id = $2 AND d.duplicate_vacancy_id = v.id)
           OR (d.duplicate_vacancy_id = $2 AND d.canonical_vacancy_id = v.id)
      )
    ORDER BY v.embedding <=> $1::vector
    LIMIT $3
  )
  SELECT id::text AS id FROM nearest ORDER BY distance, id`;

/**
 * Dense neighbours of one vacancy, nearest first, without itself, its known duplicates,
 * and inactive rows. Null when the vacancy does not exist; empty when it has no embedding.
 */
export async function findSimilar(
  client: SqlClient,
  vacancyId: string,
  limit: number,
): Promise<VacancyDto[] | null> {
  const source = await client.query(SOURCE_SQL, [vacancyId]);
  const row = source.rows[0];
  if (row === undefined) return null;
  if (row.embedding === null || row.embedding === undefined) return [];
  const ids = await neighbourIds(client, String(row.embedding), vacancyId, limit);
  const loaded = await loadVacancies(client, ids);
  return loaded.map((item) => item.vacancy);
}

async function neighbourIds(
  client: SqlClient,
  vector: string,
  vacancyId: string,
  limit: number,
): Promise<string[]> {
  const result = await inTransaction(client, async () => {
    await client.query('SET LOCAL hnsw.iterative_scan = relaxed_order');
    return client.query(NEIGHBOURS_SQL, [vector, vacancyId, limit]);
  });
  return result.rows.map((item) => String(item.id));
}
