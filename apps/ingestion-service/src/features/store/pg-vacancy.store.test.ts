import { VacancySource, VacancyStatus } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { simhash } from '../dedupe/simhash';
import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import { createPgVacancyStore } from './pg-vacancy.store';
import type { SqlClient } from './sql-client';

const DESCRIPTION = 'пишем api';

describe('createPgVacancyStore', () => {
  it('updates a vacancy when its duplicate pair already exists', async () => {
    const db = new PairDb();
    const store = createPgVacancyStore(db);
    const seen = new Date('2026-10-17T12:00:00Z');
    await store.save(vacancy(), seen);
    await store.save(vacancy({ source: VacancySource.HabrCareer, externalId: 'habr-1' }), seen);
    const nextHash = 'b'.repeat(64);
    await store.save(
      vacancy({ source: VacancySource.HabrCareer, externalId: 'habr-1', contentHash: nextHash }),
      seen,
    );
    expect(db.hashOf('HABR_CAREER', 'habr-1')).toBe(nextHash);
    expect(db.statusOf('HABR_CAREER', 'habr-1')).toBe(VacancyStatus.Duplicate);
    expect(db.pairCount()).toBe(1);
  });

  it('closes an unchanged posting when the source marks it archived', async () => {
    const db = new PairDb();
    const store = createPgVacancyStore(db);
    const seen = new Date('2026-10-17T12:00:00Z');
    await store.save(vacancy({ externalId: 'old' }), seen);
    const saved = await store.save(
      vacancy({ externalId: 'old', status: VacancyStatus.Closed }),
      seen,
    );
    expect(saved.outcome).toBe('updated');
    expect(db.statusOf(VacancySource.RabotaBy, 'old')).toBe(VacancyStatus.Closed);
  });
});

function vacancy(patch: Partial<CanonicalVacancy> = {}): CanonicalVacancy {
  return {
    source: VacancySource.RabotaBy,
    language: 'ru' as CanonicalVacancy['language'],
    externalId: 'rabota-1',
    url: 'https://rabota.by/vacancy/rabota-1',
    title: 'Backend',
    companyName: 'рога',
    companyDisplayName: 'Рога',
    unp: null,
    region: 'Минск',
    city: 'Минск',
    description: DESCRIPTION,
    descriptionRaw: DESCRIPTION,
    seniority: null,
    employment: null,
    workFormat: null,
    schedule: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryMinByn: null,
    salaryMaxByn: null,
    isGross: null,
    isForeignRemote: false,
    status: VacancyStatus.Active,
    publishedAt: null,
    contentHash: 'a'.repeat(64),
    skillsText: '',
    simhash: simhash(DESCRIPTION),
    ...patch,
  };
}

class PairDb implements SqlClient {
  private rows: Stored[] = [];
  private pairs = new Set<string>();
  private snapshot: { rows: Stored[]; pairs: Set<string> } | null = null;
  private nextId = 1;

  async query(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }> {
    if (sql === 'BEGIN') return this.begin();
    if (sql === 'COMMIT') return this.commit();
    if (sql === 'ROLLBACK') return this.rollback();
    if (sql.includes('INSERT INTO companies')) return { rows: [{ id: 'company-1' }] };
    if (sql.includes('FROM companies') || sql.includes('FROM locations')) return { rows: [] };
    if (sql.includes('AS "contentHash"')) return { rows: this.find(params) };
    if (sql.includes('INSERT INTO vacancies')) return { rows: [this.insert(params)] };
    if (sql.includes('content_hash = $26')) return this.touch(params);
    if (sql.includes('FROM vacancies v')) return { rows: this.candidates(params) };
    if (sql.includes('INSERT INTO vacancy_duplicates')) return this.addPair(sql, params);
    if (sql.includes("status = 'DUPLICATE'")) return this.markDuplicate(params);
    if (sql.includes('last_seen_at')) return this.noteSeen(sql, params);
    throw new Error(`unexpected sql: ${sql}`);
  }

  hashOf(source: string, externalId: string): string {
    return this.row(source, externalId).hash;
  }

  statusOf(source: string, externalId: string): string {
    return this.row(source, externalId).status;
  }

  pairCount(): number {
    return this.pairs.size;
  }

  private begin() {
    this.snapshot = { rows: this.rows.map((row) => ({ ...row })), pairs: new Set(this.pairs) };
    return { rows: [] };
  }

  private commit() {
    this.snapshot = null;
    return { rows: [] };
  }

  private rollback() {
    if (this.snapshot !== null) {
      this.rows = this.snapshot.rows;
      this.pairs = this.snapshot.pairs;
    }
    this.snapshot = null;
    return { rows: [] };
  }

  private find(params: readonly unknown[]): Array<Record<string, unknown>> {
    const row = this.rows.find(
      (item) => item.source === params[0] && item.externalId === params[1],
    );
    if (row === undefined) return [];
    return [{ id: row.id, contentHash: row.hash }];
  }

  private insert(params: readonly unknown[]): Record<string, unknown> {
    const id = String(this.nextId);
    this.nextId += 1;
    this.rows.push(stored(id, params));
    return { id };
  }

  private touch(params: readonly unknown[]) {
    const row = this.rows.find((item) => item.id === params[0]);
    if (row === undefined) return { rows: [], rowCount: 0 };
    row.hash = String(params[params.length - 1]);
    row.status = String(params[21]);
    row.description = String(params[8]);
    return { rows: [], rowCount: 1 };
  }

  private candidates(params: readonly unknown[]): Array<Record<string, unknown>> {
    return this.rows
      .filter((row) => row.status === VacancyStatus.Active && row.id !== params[0])
      .map((row) => ({
        id: row.id,
        source: row.source,
        title: row.title,
        description: row.description,
        city: 'Минск',
        companyName: 'рога',
      }));
  }

  private noteSeen(sql: string, params: readonly unknown[]) {
    const row = this.rows.find((item) => item.id === params[0]);
    if (row !== undefined && sql.includes('status')) row.status = String(params[2]);
    return { rows: [], rowCount: 1 };
  }

  private markDuplicate(params: readonly unknown[]) {
    const row = this.rows.find((item) => item.id === params[0]);
    if (row !== undefined) row.status = VacancyStatus.Duplicate;
    return { rows: [], rowCount: 1 };
  }

  private addPair(sql: string, params: readonly unknown[]) {
    const key = `${String(params[0])}|${String(params[1])}`;
    if (this.pairs.has(key) && !sql.includes('ON CONFLICT')) {
      throw new Error('duplicate key value violates unique constraint "vacancy_duplicates_pkey"');
    }
    this.pairs.add(key);
    return { rows: [], rowCount: 1 };
  }

  private row(source: string, externalId: string): Stored {
    const row = this.rows.find((item) => item.source === source && item.externalId === externalId);
    if (row === undefined) throw new Error(`missing ${source} ${externalId}`);
    return row;
  }
}

interface Stored {
  id: string;
  source: string;
  externalId: string;
  hash: string;
  status: string;
  title: string;
  description: string;
}

function stored(id: string, params: readonly unknown[]): Stored {
  return {
    id,
    source: String(params[0]),
    externalId: String(params[2]),
    hash: String(params[params.length - 1]),
    status: String(params[20]),
    title: String(params[4]),
    description: String(params[7]),
  };
}
