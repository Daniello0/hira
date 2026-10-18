import type { HardConstraints } from '@hira/contracts';
import type { BranchHit, ScoredVacancy } from '../search/branch-hit';
import { hardFilterSql } from '../search/hard-filters';
import { BM25_INDEX_EN, BM25_INDEX_RU, BRANCH_LIMIT } from '../search/search.constants';
import type { SqlClient } from '../search/sql-client';

/** Merges the two language indexes. A lower operator score ranks first. */
export function mergeBm25(
  russian: readonly ScoredVacancy[],
  english: readonly ScoredVacancy[],
): BranchHit[] {
  return [...russian, ...english]
    .filter((row) => row.score < 0)
    .sort((left, right) => left.score - right.score)
    .slice(0, BRANCH_LIMIT)
    .map((row, index) => ({ vacancyId: row.vacancyId, rank: index + 1, score: row.score }));
}

/** BM25 over the Russian index and the English index. */
export async function searchBm25(
  client: SqlClient,
  query: string,
  filters: HardConstraints,
): Promise<BranchHit[]> {
  const russian = await readIndex(client, query, filters, BM25_INDEX_RU, 'ru');
  const english = await readIndex(client, query, filters, BM25_INDEX_EN, 'en');
  return mergeBm25(russian, english);
}

async function readIndex(
  client: SqlClient,
  query: string,
  filters: HardConstraints,
  indexName: string,
  language: 'ru' | 'en',
): Promise<ScoredVacancy[]> {
  const filter = hardFilterSql(filters, 2);
  const result = await client.query(bm25Sql(indexName, language, filter.sql), [query, ...filter.params]);
  return result.rows.map(readScore);
}

function bm25Sql(indexName: string, language: 'ru' | 'en', filterSql: string): string {
  return `SELECT id::text AS id, score FROM (
    SELECT v.id, v.search_document <@> to_bm25query($1, '${indexName}') AS score
    FROM vacancies v
    WHERE v.language = '${language}' AND ${filterSql}
  ) ranked
  WHERE score < 0
  ORDER BY score
  LIMIT ${BRANCH_LIMIT}`;
}

function readScore(row: Record<string, unknown>): ScoredVacancy {
  return { vacancyId: String(row.id), score: Number(row.score) };
}
