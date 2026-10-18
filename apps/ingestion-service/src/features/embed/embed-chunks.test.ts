import { VacancySource } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { embedPendingChunks } from './embed-chunks';
import { EMBEDDING_WIDTH } from './embed-client';
import type { SqlClient } from '../store/sql-client';

describe('embedPendingChunks', () => {
  it('embeds paragraph slices with no prefix and writes them with the vectors', async () => {
    const db = new ChunkDb([{ id: 'v1', description: 'Alpha\n\nBeta' }]);
    const seen: unknown[] = [];
    const result = await embedPendingChunks(db, VacancySource.RabotaBy, 'http://tei:80/', {
      post: async (_url, body) => {
        seen.push(body);
        return [vector(0.1), vector(0.3)];
      },
    });
    expect(result.failed).toBe(0);
    expect(result.updated).toBe(1);
    expect(seen).toEqual([{ inputs: ['Alpha', 'Beta'], truncate: true }]);
    expect(db.chunks.get('v1')?.map((chunk) => chunk.content)).toEqual(['Alpha', 'Beta']);
    expect(db.chunks.get('v1')?.[0]?.embedding).toContain('0.1');
    expect(db.statements.some((sql) => sql.includes('UPDATE vacancies'))).toBe(false);
    expect(db.statements.some((sql) => sql.includes('embedding IS NULL'))).toBe(true);
  });

  it('leaves stored chunks in place when TEI fails', async () => {
    const db = new ChunkDb([{ id: 'v1', description: 'Alpha' }]);
    db.chunks.set('v1', [{ content: 'old', embedding: '[1]' }]);
    const result = await embedPendingChunks(db, VacancySource.RabotaBy, 'http://tei:80', {
      post: async () => {
        throw new Error('tei down');
      },
    });
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.message).toContain('tei down');
    expect(db.chunks.get('v1')).toEqual([{ content: 'old', embedding: '[1]' }]);
    expect(db.statements.some((sql) => sql.startsWith('DELETE'))).toBe(false);
  });
});

function vector(seed: number): number[] {
  return Array.from({ length: EMBEDDING_WIDTH }, () => seed);
}

class ChunkDb implements SqlClient {
  readonly statements: string[] = [];
  readonly chunks = new Map<string, Array<{ content: string; embedding: string | null }>>();

  constructor(private readonly vacancies: Array<{ id: string; description: string }>) {}

  async query(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }> {
    this.statements.push(sql);
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
    if (sql.includes('FROM vacancies')) {
      return { rows: this.vacancies.map((row) => ({ id: row.id, description: row.description })) };
    }
    if (sql.includes('DELETE FROM vacancy_chunks')) {
      this.chunks.set(String(params[0]), []);
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes('INSERT INTO vacancy_chunks')) {
      const id = String(params[0]);
      const list = this.chunks.get(id) ?? [];
      list.push({ content: String(params[2]), embedding: String(params[4]) });
      this.chunks.set(id, list);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`unexpected sql: ${sql}`);
  }
}
