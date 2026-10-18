import { ReindexScope } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { SqlClient } from '../store/sql-client';
import { clearReindex } from './clear-reindex';

const VACANCY_ID = '6d9b2f4a-6a3e-4e3a-9c1a-2b7e5d8c0f11';

describe('clearReindex', () => {
  it('deletes chunks when the scope clears vacancy embeddings', async () => {
    const sql: string[] = [];
    const client: SqlClient = {
      query: async (statement) => {
        sql.push(statement);
        return { rows: [], rowCount: 2 };
      },
    };
    await clearReindex(client, ReindexScope.Embeddings, [VACANCY_ID]);
    expect(sql[0]).toBe('BEGIN');
    expect(sql.at(-1)).toBe('COMMIT');
    expect(sql.some((statement) => statement.includes('embedding = NULL'))).toBe(true);
    expect(sql.some((statement) => statement.includes('DELETE FROM vacancy_chunks'))).toBe(true);
    expect(sql.some((statement) => statement.includes('skills_extracted_at = NULL'))).toBe(false);
  });

  it('rolls the embedding clear back when chunk delete fails', async () => {
    const sql: string[] = [];
    const client: SqlClient = {
      query: async (statement) => {
        sql.push(statement);
        if (statement.includes('DELETE FROM vacancy_chunks')) throw new Error('deadlock');
        return { rows: [], rowCount: 1 };
      },
    };
    await expect(clearReindex(client, ReindexScope.Embeddings, [VACANCY_ID])).rejects.toThrow(
      'deadlock',
    );
    expect(sql[0]).toBe('BEGIN');
    expect(sql.at(-1)).toBe('ROLLBACK');
    expect(sql.some((statement) => statement === 'COMMIT')).toBe(false);
  });

  it('keeps the clear on one pool connection', async () => {
    const sql: string[] = [];
    let released = false;
    const held: SqlClient & { release(): void } = {
      query: async (statement) => {
        sql.push(statement);
        return { rows: [], rowCount: 2 };
      },
      release: () => {
        released = true;
      },
    };
    const pool = {
      totalCount: 0,
      connect: async () => held,
      query: async () => {
        throw new Error('pool query');
      },
    };
    await clearReindex(pool as unknown as SqlClient, ReindexScope.Embeddings, [VACANCY_ID]);
    expect(sql[0]).toBe('BEGIN');
    expect(sql.at(-1)).toBe('COMMIT');
    expect(sql.filter((statement) => statement.includes('embedding = NULL'))).toHaveLength(1);
    expect(released).toBe(true);
  });
});
