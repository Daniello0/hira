import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { DuplicateDetection, VacancySource, VacancyStatus } from '@hira/contracts';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../../core-api/src/features/database/run-migrations';
import { fuzzySimilarity, simhash } from '../dedupe/simhash';
import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import { createPgVacancyStore } from './pg-vacancy.store';

const DESCRIPTION = 'пишем api';
const VECTOR = `[${Array.from({ length: 1024 }, () => 0).join(',')}]`;

const exec = promisify(execFile);
const IMAGE = 'hira-postgres-test';
const CONTAINER = 'hira-postgres-ingestion-test';
const HOST_PORT = 54330;
const DB_USER = 'hira';
const DB_PASSWORD = 'hira';
const DB_NAME = 'hira';

const canonical = (patch: Partial<CanonicalVacancy> = {}): CanonicalVacancy => ({
  source: VacancySource.RabotaBy,
  language: 'ru',
  externalId: 'hh-1',
  url: 'https://rabota.by/vacancy/hh-1',
  title: 'Backend',
  companyName: 'рога и копыта',
  companyDisplayName: 'ООО Рога и Копыта',
  unp: '100000001',
  region: 'Минск',
  city: 'Минск',
  description: DESCRIPTION,
  descriptionRaw: '<p>пишем api</p>',
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
});

describe('postgres vacancy store', () => {
  let databaseUrl = '';
  let client: Client;

  beforeAll(async () => {
    databaseUrl = await startPostgres();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await runMigrations(databaseUrl);
  }, 900_000);

  afterAll(async () => {
    await client?.end();
    await exec('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  });

  it('upserts by source and external id, and clears the vector when the hash changes', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-11T12:00:00Z');
    const inserted = await store.save(canonical(), seen);
    expect(inserted.outcome).toBe('created');
    await client.query(`UPDATE vacancies SET embedding = '${VECTOR}' WHERE external_id = 'hh-1'`);
    const skipped = await store.save(canonical(), seen);
    expect(skipped.outcome).toBe('skipped');
    const updated = await store.save(
      canonical({ contentHash: 'b'.repeat(64), title: 'Backend 2' }),
      seen,
    );
    expect(updated.outcome).toBe('updated');
    const row = await client.query(
      `SELECT title, embedding IS NULL AS cleared, search_document FROM vacancies WHERE external_id = 'hh-1'`,
    );
    expect(row.rows[0]?.title).toBe('Backend 2');
    expect(row.rows[0]?.cleared).toBe(true);
    expect(String(row.rows[0]?.search_document)).toContain('Backend 2');
  });

  it('reuses a company by UNP and stores a fuzzy duplicate without deleting the row', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-11T12:00:00Z');
    const shared = {
      unp: '100000002',
      companyName: 'другая фирма',
      companyDisplayName: 'Другая фирма',
      title: 'Дизайнер',
    };
    await store.save(
      canonical({ ...shared, externalId: 'hh-dup', contentHash: 'd'.repeat(64) }),
      seen,
    );
    await store.save(
      canonical({
        ...shared,
        source: VacancySource.Gsz,
        externalId: 'gsz-1',
        contentHash: 'e'.repeat(64),
      }),
      seen,
    );
    const companies = await client.query(
      `SELECT COUNT(*)::int AS count FROM companies WHERE unp = '100000002'`,
    );
    expect(companies.rows[0]?.count).toBe(1);
    const pair = await client.query(`SELECT detected_by, similarity FROM vacancy_duplicates`);
    expect(pair.rows[0]?.detected_by).toBe(DuplicateDetection.Fuzzy);
    expect(Number(pair.rows[0]?.similarity)).toBe(
      fuzzySimilarity(simhash(DESCRIPTION), simhash(DESCRIPTION)),
    );
    const hidden = await client.query(
      `SELECT status::text FROM vacancies WHERE external_id = 'gsz-1'`,
    );
    expect(hidden.rows[0]?.status).toBe(VacancyStatus.Duplicate);
  });

  it('keeps a city from the dictionary and a later edit of an existing duplicate', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-17T12:00:00Z');
    const shared = {
      unp: '100000090',
      companyName: 'рога локация',
      companyDisplayName: 'Рога Локация',
      title: 'Backend',
    };
    await store.save(
      canonical({ ...shared, externalId: 'rabota-loc', region: null, city: 'Минск' }),
      seen,
    );
    const place = await client.query(
      `SELECT l.region, l.city FROM vacancies v
       JOIN locations l ON l.id = v.location_id WHERE v.external_id = 'rabota-loc'`,
    );
    expect(place.rows[0]).toMatchObject({ region: 'Минск', city: 'Минск' });
    await store.save(
      canonical({
        ...shared,
        source: VacancySource.Gsz,
        externalId: 'gsz-loc',
        contentHash: 'e'.repeat(64),
      }),
      seen,
    );
    await store.save(
      canonical({
        ...shared,
        source: VacancySource.HabrCareer,
        externalId: 'habr-loc',
        region: null,
        city: null,
        contentHash: 'f'.repeat(64),
      }),
      seen,
    );
    const habrPairs = await client.query(
      `SELECT COUNT(*)::int AS count FROM vacancy_duplicates d
       JOIN vacancies dup ON dup.id = d.duplicate_vacancy_id
       WHERE dup.external_id = 'habr-loc'`,
    );
    expect(habrPairs.rows[0]?.count).toBe(0);
    const nextHash = '9'.repeat(64);
    await store.save(
      canonical({
        ...shared,
        source: VacancySource.Gsz,
        externalId: 'gsz-loc',
        contentHash: nextHash,
        schedule: '5/2',
      }),
      seen,
    );
    const edited = await client.query(
      `SELECT content_hash, status::text AS status FROM vacancies WHERE external_id = 'gsz-loc'`,
    );
    expect(edited.rows[0]?.content_hash).toBe(nextHash);
    expect(edited.rows[0]?.status).toBe(VacancyStatus.Duplicate);
  });

  it('rejects a write that would set search_document explicitly', async () => {
    await expect(
      client.query(
        `INSERT INTO vacancies (source, language, external_id, title, status, search_document)
         VALUES ('RABOTA_BY', 'ru', 'bad', 'Bad', 'ACTIVE', 'manual')`,
      ),
    ).rejects.toThrow(/search_document|generated/i);
  });
});

async function startPostgres(): Promise<string> {
  await exec('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  const context = path.resolve(__dirname, '../../../../../infra/postgres');
  await exec('docker', ['build', '-t', IMAGE, context]);
  await exec('docker', [
    'run',
    '-d',
    '--name',
    CONTAINER,
    '-e',
    `POSTGRES_USER=${DB_USER}`,
    '-e',
    `POSTGRES_PASSWORD=${DB_PASSWORD}`,
    '-e',
    `POSTGRES_DB=${DB_NAME}`,
    '-p',
    `${HOST_PORT}:5432`,
    IMAGE,
    'postgres',
    '-c',
    'shared_preload_libraries=pg_textsearch',
    '-c',
    'hnsw.iterative_scan=relaxed_order',
  ]);
  const databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${HOST_PORT}/${DB_NAME}`;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await canQuery(databaseUrl)) return databaseUrl;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('test postgres did not accept queries');
}

async function canQuery(databaseUrl: string): Promise<boolean> {
  const probe = new Client({ connectionString: databaseUrl });
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}
