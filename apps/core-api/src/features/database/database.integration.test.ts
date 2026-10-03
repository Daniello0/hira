import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { revertLastMigration, runMigrations } from './run-migrations';

const exec = promisify(execFile);
const IMAGE = 'hira-postgres-test';
const CONTAINER = 'hira-postgres-stage3-test';
const HOST_PORT = 54329;
const DB_USER = 'hira';
const DB_PASSWORD = 'hira';
const DB_NAME = 'hira';
const START_TIMEOUT_MS = 900_000;
const QUERY_TIMEOUT_MS = 30_000;
const SEED_COUNT = 13;

const EXPECTED_REGIONS = [
  'Брестская область',
  'Витебская область',
  'Гомельская область',
  'Гродненская область',
  'Минская область',
  'Могилёвская область',
  'Минск',
];

const EXPECTED_CITIES = ['Брест', 'Витебск', 'Гомель', 'Гродно', 'Могилёв', 'Минск'];

describe('postgres schema', () => {
  let databaseUrl = '';
  let client: Client;

  beforeAll(async () => {
    databaseUrl = await startTestPostgres();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await runMigrations(databaseUrl);
  }, START_TIMEOUT_MS);

  afterAll(async () => {
    await client?.end();
    await removeContainer();
  });

  it('installs the search extensions', async () => {
    const rows = await rowsOf<{ name: string }>('SELECT extname AS name FROM pg_extension');
    const names = rows.map((row) => row.name);
    expect(names).toEqual(
      expect.arrayContaining(['vector', 'pg_trgm', 'pg_textsearch', 'uuid-ossp']),
    );
  });

  it('enables iterative HNSW scans on the server', async () => {
    const rows = await rowsOf<{ value: string }>(
      `SELECT current_setting('hnsw.iterative_scan') AS value`,
    );
    expect(rows[0]?.value).toBe('relaxed_order');
  });

  it('seeds oblasts, Minsk, and oblast centers with parent links', async () => {
    const regions = await rowsOf<{ region: string; city: string | null }>(
      'SELECT region, city FROM locations ORDER BY region, city NULLS FIRST',
    );
    expect(regions).toHaveLength(SEED_COUNT);
    expect(unique(regions.map((row) => row.region))).toEqual([...EXPECTED_REGIONS].sort());
    expect(regions.flatMap((row) => (row.city === null ? [] : [row.city])).sort()).toEqual(
      [...EXPECTED_CITIES].sort(),
    );
    const minskOblastCities = regions.filter((row) => row.region === 'Минская область' && row.city);
    expect(minskOblastCities).toEqual([]);
    const brest = await rowsOf<{ parent: string | null }>(
      `SELECT parent.region AS parent
       FROM locations city
       JOIN locations parent ON parent.id = city.parent_id
       WHERE city.city = 'Брест'`,
    );
    expect(brest[0]?.parent).toBe('Брестская область');
  });

  it('rejects a duplicate region and city', async () => {
    await expectSqlState(
      `INSERT INTO locations (region, city) VALUES ('Брестская область', 'Брест')`,
      '23505',
    );
  });

  it(
    'rejects a duplicate vacancy key, a bad enum, a bad language, and a short vector',
    async () => {
      await insertVacancy('ext-1', 'ru', 'PostgreSQL');
      await expectSqlState(vacancySql('ext-1', 'ru', 'Again'), '23505');
      await expectSqlState(
        `INSERT INTO vacancies (source, language, external_id, title, status)
         VALUES ('RABOTA_BY', 'ru', 'ext-2', 'Bad', 'ARCHIVED')`,
        '22P02',
      );
      await expectSqlState(vacancySql('ext-3', 'de', 'Deutsch'), '23514');
      await expectSqlState(
        `UPDATE vacancies SET embedding = '[0,0,0]'::vector WHERE external_id = 'ext-1'`,
        '22000',
      );
    },
    QUERY_TIMEOUT_MS,
  );

  it('rejects an uppercase email and a confidence outside 0..1', async () => {
    await expectSqlState(
      `INSERT INTO users (email, password_hash) VALUES ('Mixed@example.com', 'hash')`,
      '23514',
    );
    const userId = await insertUser('seeker@example.com');
    const skillId = await insertSkill('PostgreSQL');
    await expectSqlState(
      `INSERT INTO user_profile_skills (user_id, skill_id, level, source, confidence)
       VALUES ('${userId}', ${skillId}, 'BASIC', 'SELF_REPORTED', 1.5)`,
      '23514',
    );
  });

  it('rejects a resume that is not PDF and a note that is PDF', async () => {
    const userId = await insertUser('reader@example.com');
    await expectSqlState(documentSql(userId, 'RESUME', 'MD'), '23514');
    await expectSqlState(documentSql(userId, 'NOTE', 'PDF'), '23514');
    await client.query(documentSql(userId, 'RESUME', 'PDF'));
  });

  it('keeps the lexical document on the vacancy row and refreshes updated_at', async () => {
    await insertVacancy('ext-doc', 'ru', 'PostgreSQL');
    const before = await documentOf('ext-doc');
    expect(before.document).toBe('PostgreSQL');
    await client.query(
      `UPDATE vacancies
       SET title = 'Docker', skills_text = 'Kubernetes', updated_at = '2000-01-01'
       WHERE external_id = 'ext-doc'`,
    );
    const after = await documentOf('ext-doc');
    expect(after.document).toBe('Docker\nKubernetes');
    expect(new Date(after.updatedAt).getUTCFullYear()).toBeGreaterThan(2000);
  });

  it('scores a Russian vacancy with the Russian BM25 index only', async () => {
    await insertVacancy('ext-ru', 'ru', 'Kubernetes инженер');
    await insertVacancy('ext-en', 'en', 'Kubernetes engineer');
    const russian = await rowsOf<{ score: number }>(
      `SELECT search_document <@> to_bm25query('Kubernetes', 'idx_vac_bm25_ru') AS score
       FROM vacancies WHERE external_id = 'ext-ru'`,
    );
    expect(typeof russian[0]?.score).toBe('number');
    const englishOnly = await rowsOf<{ id: string }>(
      `SELECT id::text FROM vacancies
       WHERE language = 'en' AND external_id = 'ext-en'
         AND search_document <@> to_bm25query('engineer', 'idx_vac_bm25_en') < 0`,
    );
    expect(englishOnly).toHaveLength(1);
    const indexes = await rowsOf<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE indexname IN ('idx_vac_bm25_ru', 'idx_vac_bm25_en')`,
    );
    expect(indexes.map((row) => row.indexdef).join('\n')).toContain('russian');
    expect(indexes.map((row) => row.indexdef).join('\n')).toContain('english');
  });

  it('creates HNSW and trigram indexes with the agreed parameters', async () => {
    const indexes = await rowsOf<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const byName = new Map(indexes.map((row) => [row.indexname, row.indexdef]));
    expect(byName.get('idx_vac_emb_hnsw')).toContain('vector_cosine_ops');
    expect(byName.get('idx_vac_emb_hnsw')).toMatch(/m\s*=\s*'?16'?/);
    expect(byName.get('idx_vac_emb_hnsw')).toMatch(/ef_construction\s*=\s*'?64'?/);
    expect(byName.get('idx_vac_title_trgm')).toContain('gin_trgm_ops');
    expect(byName.get('idx_company_name_trgm')).toContain('gin_trgm_ops');
    expect(byName.get('idx_skill_alias_trgm')).toContain('gin_trgm_ops');
    expect(byName.has('idx_vac_chunk_emb_hnsw')).toBe(true);
    expect(byName.has('idx_skills_emb_hnsw')).toBe(true);
    expect(byName.has('idx_occupations_emb_hnsw')).toBe(true);
    expect(byName.has('idx_user_profiles_emb_hnsw')).toBe(true);
    expect(byName.has('idx_user_memories_emb_hnsw')).toBe(true);
    expect(byName.has('idx_user_documents_emb_hnsw')).toBe(true);
  });

  it('drops user documents with the user and vacancy chunks with the vacancy', async () => {
    const userId = await insertUser('owner@example.com');
    await client.query(documentSql(userId, 'NOTE', 'TXT'));
    const vacancyId = await insertVacancy('ext-cascade', 'en', 'Cascade');
    await client.query(
      `INSERT INTO vacancy_chunks (vacancy_id, chunk_index, content, token_count)
       VALUES ('${vacancyId}', 0, 'chunk', 1)`,
    );
    await client.query(`DELETE FROM users WHERE id = '${userId}'`);
    const documents = await rowsOf<{ count: number }>(
      `SELECT count(*)::int AS count FROM user_documents WHERE user_id = '${userId}'`,
    );
    expect(documents[0]?.count).toBe(0);
    const vacancies = await rowsOf<{ count: number }>(
      `SELECT count(*)::int AS count FROM vacancies WHERE external_id = 'ext-cascade'`,
    );
    expect(vacancies[0]?.count).toBe(1);
    await client.query(`DELETE FROM vacancies WHERE id = '${vacancyId}'`);
    const chunks = await rowsOf<{ count: number }>(
      `SELECT count(*)::int AS count FROM vacancy_chunks WHERE vacancy_id = '${vacancyId}'`,
    );
    expect(chunks[0]?.count).toBe(0);
  });

  it('clears the company industry when the industry row goes away and rejects an unknown one', async () => {
    await expectSqlState(
      `INSERT INTO companies (name, normalized_name, industry_id) VALUES ('Unknown', 'unknown', 99999)`,
      '23503',
    );
    const industry = await rowsOf<{ id: number }>(
      `INSERT INTO industries (name) VALUES ('Software') RETURNING id`,
    );
    const company = await rowsOf<{ id: string }>(
      `INSERT INTO companies (name, normalized_name, industry_id)
       VALUES ('Local', 'local', ${industry[0]?.id ?? 0}) RETURNING id::text`,
    );
    await client.query(`DELETE FROM industries WHERE id = ${industry[0]?.id ?? 0}`);
    const left = await rowsOf<{ industryId: number | null }>(
      `SELECT industry_id AS "industryId" FROM companies WHERE id = '${company[0]?.id}'`,
    );
    expect(left[0]?.industryId).toBeNull();
  });

  it('applies the migration a second time without duplicating locations', async () => {
    await runMigrations(databaseUrl);
    const rows = await rowsOf<{ count: number }>('SELECT count(*)::int AS count FROM locations');
    expect(rows[0]?.count).toBe(SEED_COUNT);
  });

  it('reverts the schema and restores the seed', async () => {
    await revertLastMigration(databaseUrl);
    const gone = await rowsOf<{ name: string | null }>(
      "SELECT to_regclass('public.vacancies') AS name",
    );
    expect(gone[0]?.name).toBeNull();
    await runMigrations(databaseUrl);
    const restored = await rowsOf<{ count: number }>(
      'SELECT count(*)::int AS count FROM locations',
    );
    expect(restored[0]?.count).toBe(SEED_COUNT);
  });

  async function rowsOf<T>(sql: string): Promise<T[]> {
    const result = await client.query(sql);
    return result.rows as T[];
  }

  async function expectSqlState(sql: string, sqlState: string): Promise<void> {
    try {
      await client.query(sql);
    } catch (error) {
      expect(readSqlState(error)).toBe(sqlState);
      return;
    }
    throw new Error(`expected SQLSTATE ${sqlState}`);
  }

  async function insertUser(email: string): Promise<string> {
    const rows = await rowsOf<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ('${email}', 'hash') RETURNING id::text`,
    );
    return rows[0]?.id ?? '';
  }

  async function insertSkill(name: string): Promise<number> {
    const rows = await rowsOf<{ id: number }>(
      `INSERT INTO skills (canonical_name, skill_type) VALUES ('${name}', 'TOOL') RETURNING id`,
    );
    return rows[0]?.id ?? 0;
  }

  async function insertVacancy(
    externalId: string,
    language: string,
    title: string,
  ): Promise<string> {
    const rows = await rowsOf<{ id: string }>(
      vacancySql(externalId, language, title) + ' RETURNING id::text',
    );
    return rows[0]?.id ?? '';
  }

  async function documentOf(externalId: string): Promise<{ document: string; updatedAt: string }> {
    const rows = await rowsOf<{ document: string; updatedAt: string }>(
      `SELECT search_document AS document, updated_at AS "updatedAt"
       FROM vacancies WHERE external_id = '${externalId}'`,
    );
    return rows[0] ?? { document: '', updatedAt: '' };
  }
});

function vacancySql(externalId: string, language: string, title: string): string {
  return (
    `INSERT INTO vacancies (source, language, external_id, title, status) ` +
    `VALUES ('RABOTA_BY', '${language}', '${externalId}', '${title}', 'ACTIVE')`
  );
}

function documentSql(userId: string, kind: string, format: string): string {
  const hash = 'a'.repeat(64);
  return (
    `INSERT INTO user_documents ` +
    `(user_id, kind, title, format, storage_path, content_hash, extracted_text, created_by) ` +
    `VALUES ('${userId}', '${kind}', 'File', '${format}', 'storage/${userId}', '${hash}', 'body', 'USER')`
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function readSqlState(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return String(error.code);
  }
  return '';
}

async function startTestPostgres(): Promise<string> {
  await removeContainer();
  await buildImage();
  await runContainer();
  const databaseUrl = `postgresql://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${HOST_PORT}/${DB_NAME}`;
  await waitForQueries(databaseUrl);
  return databaseUrl;
}

async function removeContainer(): Promise<void> {
  await exec('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
}

async function buildImage(): Promise<void> {
  const context = path.resolve(__dirname, '../../../../../infra/postgres');
  await exec('docker', ['build', '-t', IMAGE, context]);
}

async function runContainer(): Promise<void> {
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
}

async function waitForQueries(databaseUrl: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await canQuery(databaseUrl)) {
      return;
    }
    await delay(500);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
