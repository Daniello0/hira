import { ReindexScope } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { SqlClient } from '../store/sql-client';
import { clearReindex } from './clear-reindex';

describe('clearReindex', () => {
  it('deletes chunks when the scope clears vacancy embeddings', async () => {
    const sql: string[] = [];
    const client: SqlClient = {
      query: async (statement) => {
        sql.push(statement);
        return { rows: [], rowCount: 2 };
      },
    };
    await clearReindex(client, ReindexScope.Embeddings, ['6d9b2f4a-6a3e-4e3a-9c1a-2b7e5d8c0f11']);
    expect(sql.some((statement) => statement.includes('embedding = NULL'))).toBe(true);
    expect(sql.some((statement) => statement.includes('DELETE FROM vacancy_chunks'))).toBe(true);
    expect(sql.some((statement) => statement.includes('skills_extracted_at = NULL'))).toBe(false);
  });
});
