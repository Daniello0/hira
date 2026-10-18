import { WorkFormat } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { BRANCH_LIMIT } from '../search/search.constants';
import type { SqlClient } from '../search/sql-client';
import { mergeBm25, searchBm25 } from './bm25-search';

describe('mergeBm25', () => {
  it('orders by the operator score and numbers ranks from 1', () => {
    expect(
      mergeBm25(
        [{ vacancyId: 'ru', score: -0.2 }],
        [{ vacancyId: 'en', score: -0.9 }],
      ),
    ).toEqual([
      { vacancyId: 'en', rank: 1, score: -0.9 },
      { vacancyId: 'ru', rank: 2, score: -0.2 },
    ]);
  });

  it('keeps at most the branch limit', () => {
    const russian = Array.from({ length: BRANCH_LIMIT }, (_, index) => ({
      vacancyId: `ru-${index}`,
      score: -1,
    }));
    const merged = mergeBm25(russian, [{ vacancyId: 'en', score: -0.01 }]);
    expect(merged).toHaveLength(BRANCH_LIMIT);
    expect(merged.some((hit) => hit.vacancyId === 'en')).toBe(false);
  });
});

describe('searchBm25', () => {
  it('queries each language index and merges scores below zero', async () => {
    const calls: string[] = [];
    const client: SqlClient = {
      query: async (sql) => {
        calls.push(sql);
        if (sql.includes('idx_vac_bm25_ru')) return { rows: [{ id: 'ru-1', score: -0.4 }] };
        return { rows: [{ id: 'en-1', score: -0.2 }, { id: 'weak', score: 0 }] };
      },
    };
    const hits = await searchBm25(client, 'Kubernetes', { workFormat: [WorkFormat.Remote] });
    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('idx_vac_bm25_ru');
    expect(calls[0]).toContain("v.language = 'ru'");
    expect(calls[0]).toContain('score < 0');
    expect(calls[0]).toContain('ORDER BY score');
    expect(calls[0]).toContain('v.work_format = ANY');
    expect(calls[1]).toContain('idx_vac_bm25_en');
    expect(calls[1]).toContain("v.language = 'en'");
    expect(hits.map((hit) => hit.vacancyId)).toEqual(['ru-1', 'en-1']);
    expect(hits.every((hit) => hit.score < 0)).toBe(true);
  });
});
