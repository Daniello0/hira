import { describe, expect, it } from 'vitest';
import type { DataSource } from 'typeorm';
import { TypeOrmProfileStore } from './typeorm-profile.store';

describe('skill match sql', () => {
  it('admits a fuzzy alias the way retrieval does', async () => {
    let sql = '';
    const db = {
      query: (statement: string) => {
        sql = statement;
        return [];
      },
    };
    const store = new TypeOrmProfileStore(db as unknown as DataSource);
    await store.matchSkill('k8s');
    expect(sql.slice(sql.indexOf('FROM skills'))).toContain('similarity(a.alias');
  });
});
