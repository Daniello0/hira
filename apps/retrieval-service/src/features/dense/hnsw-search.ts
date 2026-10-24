import type { BranchHit } from '../search/branch-hit';
import { hardFilterSql, type SearchFilters } from '../search/hard-filters';
import { inTransaction } from '../search/in-transaction';
import { BRANCH_LIMIT, DENSE_PAGE_CAP } from '../search/search.constants';
import type { SqlClient } from '../search/sql-client';
import { vectorLiteral } from './embed-query';

export interface ChunkDistance {
  vacancyId: string;
  distance: number;
}

/** Keeps the nearest chunk of each vacancy, nearest first. */
export function maxPool(rows: readonly ChunkDistance[]): ChunkDistance[] {
  const best = new Map<string, number>();
  for (const row of rows) keepNearer(best, row);
  return [...best.entries()]
    .map(([vacancyId, distance]) => ({ vacancyId, distance }))
    .sort((left, right) => left.distance - right.distance);
}

/** Next HNSW page size, or null when the scan should stop. */
export function nextPageLimit(
  current: number,
  rowCount: number,
  distinctVacancies: number,
): number | null {
  if (distinctVacancies >= BRANCH_LIMIT || rowCount < current || current >= DENSE_PAGE_CAP)
    return null;
  return Math.min(current * 2, DENSE_PAGE_CAP);
}

/** Cosine search over chunk embeddings, pooled up to the branch limit. */
export async function searchDense(
  client: SqlClient,
  vector: readonly number[],
  filters: SearchFilters,
): Promise<BranchHit[]> {
  const literal = vectorLiteral(vector);
  const pooled = await inTransaction(client, () => scanPages(client, literal, filters));
  return rankDistances(pooled);
}

async function scanPages(
  client: SqlClient,
  literal: string,
  filters: SearchFilters,
): Promise<ChunkDistance[]> {
  await client.query('SET LOCAL hnsw.iterative_scan = relaxed_order');
  let limit: number | null = BRANCH_LIMIT;
  let pooled: ChunkDistance[] = [];
  while (limit !== null) {
    const rows = await readPage(client, literal, filters, limit);
    pooled = maxPool(rows);
    limit = nextPageLimit(limit, rows.length, pooled.length);
  }
  return pooled.slice(0, BRANCH_LIMIT);
}

async function readPage(
  client: SqlClient,
  literal: string,
  filters: SearchFilters,
  limit: number,
): Promise<ChunkDistance[]> {
  const filter = hardFilterSql(filters, 3);
  const result = await client.query(pageSql(filter.sql), [literal, limit, ...filter.params]);
  return result.rows.map(readDistance);
}

function pageSql(filterSql: string): string {
  return `SELECT c.vacancy_id::text AS "vacancyId", c.embedding <=> $1::vector AS distance
    FROM vacancy_chunks c
    JOIN vacancies v ON v.id = c.vacancy_id
    WHERE c.embedding IS NOT NULL AND ${filterSql}
    ORDER BY c.embedding <=> $1::vector
    LIMIT $2`;
}

function rankDistances(rows: readonly ChunkDistance[]): BranchHit[] {
  return rows.map((row, index) => ({
    vacancyId: row.vacancyId,
    rank: index + 1,
    score: row.distance,
  }));
}

function keepNearer(best: Map<string, number>, row: ChunkDistance): void {
  const current = best.get(row.vacancyId);
  if (current === undefined || row.distance < current) best.set(row.vacancyId, row.distance);
}

function readDistance(row: Record<string, unknown>): ChunkDistance {
  return { vacancyId: String(row.vacancyId), distance: Number(row.distance) };
}
