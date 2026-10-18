import { WorkFormat } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { BRANCH_LIMIT, DENSE_PAGE_CAP, EMBEDDING_WIDTH } from '../search/search.constants';
import type { SqlClient } from '../search/sql-client';
import { maxPool, nextPageLimit, searchDense } from './hnsw-search';

const QUERY_VECTOR = Array.from({ length: EMBEDDING_WIDTH }, (_, index) => (index === 0 ? 0.5 : 0));

describe('maxPool', () => {
  it('keeps the smallest distance for each vacancy', () => {
    expect(
      maxPool([
        { vacancyId: 'a', distance: 0.4 },
        { vacancyId: 'a', distance: 0.1 },
        { vacancyId: 'b', distance: 0.2 },
      ]),
    ).toEqual([
      { vacancyId: 'a', distance: 0.1 },
      { vacancyId: 'b', distance: 0.2 },
    ]);
  });
});

describe('nextPageLimit', () => {
  it('doubles until the page cap when one page is full of too few vacancies', () => {
    expect(nextPageLimit(BRANCH_LIMIT, BRANCH_LIMIT, 2)).toBe(200);
    expect(nextPageLimit(200, 200, 10)).toBe(DENSE_PAGE_CAP);
    expect(nextPageLimit(DENSE_PAGE_CAP, DENSE_PAGE_CAP, 10)).toBeNull();
    expect(nextPageLimit(BRANCH_LIMIT, 50, 10)).toBeNull();
    expect(nextPageLimit(BRANCH_LIMIT, BRANCH_LIMIT, BRANCH_LIMIT)).toBeNull();
  });
});

describe('searchDense', () => {
  it('pools chunks to vacancies and skips a chunk without a vector', async () => {
    const sql: string[] = [];
    const client: SqlClient = {
      query: async (statement, params) => {
        sql.push(statement);
        if (statement === 'BEGIN' || statement === 'COMMIT' || statement.startsWith('SET')) {
          return { rows: [] };
        }
        expect(params?.[0]).toContain('0.5');
        return {
          rows: [
            { vacancyId: 'a', distance: 0.4 },
            { vacancyId: 'a', distance: 0.1 },
            { vacancyId: 'b', distance: 0.3 },
          ],
        };
      },
    };
    const hits = await searchDense(client, QUERY_VECTOR, { workFormat: [WorkFormat.Remote] });
    expect(sql.some((statement) => statement.includes('hnsw.iterative_scan'))).toBe(true);
    expect(sql.some((statement) => statement.includes('relaxed_order'))).toBe(true);
    const select = sql.find((statement) => statement.includes('vacancy_chunks'));
    expect(select).toContain('<=>');
    expect(select).toContain('c.embedding IS NOT NULL');
    expect(select).toContain('v.work_format = ANY');
    expect(select).not.toContain('v.embedding');
    expect(hits).toEqual([
      { vacancyId: 'a', rank: 1, score: 0.1 },
      { vacancyId: 'b', rank: 2, score: 0.3 },
    ]);
  });

  it('widens the page until the cap when every chunk belongs to one vacancy', async () => {
    const limits: number[] = [];
    const client: SqlClient = {
      query: async (statement, params) => {
        if (!statement.includes('vacancy_chunks')) return { rows: [] };
        const limit = Number(params?.[1]);
        limits.push(limit);
        return {
          rows: Array.from({ length: limit }, () => ({ vacancyId: 'only', distance: 0.2 })),
        };
      },
    };
    const hits = await searchDense(client, QUERY_VECTOR, {});
    expect(limits).toEqual([BRANCH_LIMIT, 200, DENSE_PAGE_CAP]);
    expect(hits).toEqual([{ vacancyId: 'only', rank: 1, score: 0.2 }]);
  });
});
