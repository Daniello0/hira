import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  QueryComplexity,
  ReindexScope,
  RetrievalBranch,
  SkillEdgeType,
  SkillImportance,
  VacancySource,
  VacancyStatus,
  WorkFormat,
} from '@hira/contracts';
import { Client } from 'pg';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../../core-api/src/features/database/run-migrations';
import { embedPendingChunks } from '../../../../ingestion-service/src/features/embed/embed-chunks';
import { clearReindex } from '../../../../ingestion-service/src/features/reindex/clear-reindex';
import { simhash } from '../../../../ingestion-service/src/features/dedupe/simhash';
import { writeVacancySkills } from '../../../../ingestion-service/src/features/skills/write-vacancy-skills';
import type { CanonicalVacancy } from '../../../../ingestion-service/src/features/normalize/normalize-vacancy';
import { createPgVacancyStore } from '../../../../ingestion-service/src/features/store/pg-vacancy.store';
import { createApp } from '../../app';
import { listen } from '../../common/utils/listen';
import { searchBm25 } from '../lexical/bm25-search';
import { searchDense } from '../dense/hnsw-search';
import { fuseBranches } from '../fusion/rrf-fusion';
import { coverageFor, searchGraph } from '../graph/graph-search';
import { resolveQuerySkills } from '../graph/load-link-hits';
import { explainVacancies } from '../explain/explain-skills';
import { EMBEDDING_WIDTH } from './search.constants';
import { loadVacancies } from './load-vacancy';
import { emptyIntent } from './run-branches';
import type { SearchPorts } from './run-search';

const exec = promisify(execFile);
const IMAGE = 'hira-postgres-test';
const CONTAINER = 'hira-postgres-retrieval-test';
const HOST_PORT = 54332;
const DB_USER = 'hira';
const DB_PASSWORD = 'hira';
const DB_NAME = 'hira';

describe('lexical and dense search against postgres', () => {
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

  it('ranks BM25 hits from both languages and applies salary and location inside the query', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-18T09:00:00Z');
    const minsk = await store.save(
      vacancy({ externalId: 'pay-minsk', title: 'зарплатауника', salaryMaxByn: 2000 }),
      seen,
    );
    await store.save(
      vacancy({
        externalId: 'pay-brest',
        title: 'зарплатауника',
        salaryMaxByn: 100,
        region: 'Брестская область',
        city: 'Брест',
      }),
      seen,
    );
    await store.save(
      vacancy({
        externalId: 'pay-dead',
        title: 'зарплатауника',
        status: VacancyStatus.Expired,
        salaryMaxByn: 9000,
      }),
      seen,
    );
    const english = await store.save(
      vacancy({
        externalId: 'pay-en',
        language: 'en',
        title: 'uniqueword',
        description: 'english only',
      }),
      seen,
    );
    const hits = await searchBm25(client, 'зарплатауника', { salaryMin: 500, location: ['Минск'] });
    expect(hits.map((hit) => hit.vacancyId)).toEqual([minsk.id]);
    expect(hits[0]?.score).toBeLessThan(0);
    const englishHits = await searchBm25(client, 'uniqueword', {});
    expect(englishHits.map((hit) => hit.vacancyId)).toContain(english.id);
    expect(englishHits.every((hit) => hit.score < 0)).toBe(true);
  });

  it('max-pools chunk distances and keeps hard filters inside the HNSW query', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-18T09:00:00Z');
    const near = await store.save(
      vacancy({ externalId: 'dense-near', workFormat: WorkFormat.Remote }),
      seen,
    );
    const far = await store.save(
      vacancy({ externalId: 'dense-far', workFormat: WorkFormat.Remote }),
      seen,
    );
    const onsite = await store.save(
      vacancy({ externalId: 'dense-onsite', workFormat: WorkFormat.Onsite }),
      seen,
    );
    await insertChunk(client, near.id, 0, basis(3));
    await insertChunk(client, near.id, 1, basis(4));
    await insertChunk(client, near.id, 2, null);
    await insertChunk(client, far.id, 0, basis(5));
    await insertChunk(client, onsite.id, 0, basis(3));
    const hits = await searchDense(client, basisValues(3), { workFormat: [WorkFormat.Remote] });
    const ids = hits.map((hit) => hit.vacancyId);
    expect(ids[0]).toBe(near.id);
    expect(hits[0]?.score).toBeLessThan(0.01);
    expect(ids).toContain(far.id);
    expect(ids).not.toContain(onsite.id);
    expect(hits.filter((hit) => hit.vacancyId === near.id)).toHaveLength(1);
  });

  it('drops chunks on a source change and on reindex, and leaves them when skills are written', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-18T09:00:00Z');
    const saved = await store.save(
      vacancy({ externalId: 'chunk-life', description: 'старое описание' }),
      seen,
    );
    await insertChunk(client, saved.id, 0, basis(6));
    const skipped = await store.save(
      vacancy({ externalId: 'chunk-life', description: 'старое описание' }),
      seen,
    );
    expect(skipped.outcome).toBe('skipped');
    expect(await chunkCount(client, saved.id)).toBe(1);
    const skill = await client.query(
      `INSERT INTO skills (canonical_name, skill_type) VALUES ('Chunk Skill', 'HARD') RETURNING id`,
    );
    await writeVacancySkills(
      client,
      saved.id,
      [
        {
          skillId: Number(skill.rows[0]?.id),
          importance: SkillImportance.Required,
          weight: 1,
          evidenceSpan: null,
        },
      ],
      seen,
    );
    expect(await chunkCount(client, saved.id)).toBe(1);
    const vector = await client.query(
      `SELECT embedding IS NULL AS empty FROM vacancies WHERE id = $1`,
      [saved.id],
    );
    expect(vector.rows[0]?.empty).toBe(true);
    await store.save(
      vacancy({
        externalId: 'chunk-life',
        description: 'новое описание',
        contentHash: 'b'.repeat(64),
      }),
      seen,
    );
    expect(await chunkCount(client, saved.id)).toBe(0);
    await insertChunk(client, saved.id, 0, basis(6));
    await clearReindex(client, ReindexScope.Embeddings, [saved.id]);
    expect(await chunkCount(client, saved.id)).toBe(0);
  });

  it('embeds pending chunks through the ingestion tick and serves lexical counts over HTTP', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-18T09:00:00Z');
    const saved = await store.save(
      vacancy({
        externalId: 'embed-chunk',
        title: 'векторчанка',
        description: 'Alpha paragraph\n\nBeta paragraph',
        skillsText: 'Python',
      }),
      seen,
    );
    await client.query(
      `UPDATE vacancies SET skills_extracted_at = now(), embedding = NULL WHERE id = $1`,
      [saved.id],
    );
    const embedded = await embedPendingChunks(client, VacancySource.RabotaBy, 'http://tei', {
      post: async (_url, body) => {
        const inputs = (body as { inputs: string[] }).inputs;
        return inputs.map(() => basisValues(7));
      },
    });
    expect(embedded.failed).toBe(0);
    const stored = await client.query(
      `SELECT chunk_index, content, embedding IS NOT NULL AS ready
       FROM vacancy_chunks WHERE vacancy_id = $1 ORDER BY chunk_index`,
      [saved.id],
    );
    expect(stored.rows.map((row) => row.content)).toEqual(['Alpha paragraph', 'Beta paragraph']);
    expect(stored.rows.every((row) => row.ready === true)).toBe(true);
    const failing = await embedPendingChunks(client, VacancySource.RabotaBy, 'http://tei', {
      post: async () => {
        throw new Error('tei down');
      },
    });
    expect(failing.failed).toBeGreaterThanOrEqual(0);
    expect(await chunkCount(client, saved.id)).toBe(2);

    const app = createApp({
      logger: pino({ level: 'silent' }),
      internalToken: 'secret',
      probes: [],
      search: portsFor(client),
    });
    const server = await listen(app, 0);
    const address = server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    try {
      const response = await fetch(`http://127.0.0.1:${port}/internal/v1/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Internal-Token': 'secret' },
        body: JSON.stringify({
          intent: emptyIntent('векторчанка'),
          options: { branches: ['LEXICAL'], rerank: false },
        }),
      });
      const body = (await response.json()) as {
        results: Array<{ score: number; explanation: { totalScore: number } }>;
        diagnostics: { candidateCounts: { LEXICAL: number }; rerankApplied: boolean };
      };
      expect(response.status).toBe(200);
      expect(body.results.length).toBeGreaterThan(0);
      expect(body.results[0]?.score).toBe(body.results[0]?.explanation.totalScore);
      expect(body.diagnostics.candidateCounts.LEXICAL).toBeGreaterThan(0);
      expect(body.diagnostics.rerankApplied).toBe(false);
      const down = await request(app)
        .post('/internal/v1/search')
        .set('X-Internal-Token', 'secret')
        .send({ intent: emptyIntent('векторчанка') });
      expect(down.status).toBe(503);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('ranks coverage through two hops and drops a dead denominator, an expired card, and BROADER', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-18T11:00:00Z');
    const python = await insertSkill(client, 'Graph Python', 2);
    const docker = await insertSkill(client, 'Graph Docker', 2);
    const helm = await insertSkill(client, 'Graph Helm', 2);
    const k8s = await insertSkill(client, 'Graph Kubernetes', 2);
    const noise = await insertSkill(client, 'Graph Noise', 0);
    await insertEdge(client, python, docker, SkillEdgeType.RelatedTo, 1);
    await insertEdge(client, docker, helm, SkillEdgeType.Narrower, 1);
    await insertEdge(client, helm, k8s, SkillEdgeType.AlternativeOf, 1);
    await insertEdge(client, python, noise, SkillEdgeType.Broader, 1);
    const direct = await store.save(vacancy({ externalId: 'graph-direct' }), seen);
    const related = await store.save(vacancy({ externalId: 'graph-related' }), seen);
    const second = await store.save(vacancy({ externalId: 'graph-second' }), seen);
    const third = await store.save(vacancy({ externalId: 'graph-third' }), seen);
    const broader = await store.save(vacancy({ externalId: 'graph-broader' }), seen);
    const expired = await store.save(
      vacancy({ externalId: 'graph-expired', status: VacancyStatus.Expired }),
      seen,
    );
    const onsite = await store.save(
      vacancy({ externalId: 'graph-onsite', workFormat: WorkFormat.Onsite }),
      seen,
    );
    await linkSkill(client, direct.id, python, SkillImportance.Required, seen);
    await linkSkill(client, related.id, docker, SkillImportance.Preferred, seen);
    await linkSkill(client, second.id, helm, SkillImportance.Mentioned, seen);
    await linkSkill(client, third.id, k8s, SkillImportance.Required, seen);
    await linkSkill(client, broader.id, noise, SkillImportance.Required, seen);
    await linkSkill(client, expired.id, python, SkillImportance.Required, seen);
    await linkSkill(client, onsite.id, python, SkillImportance.Required, seen);
    const hits = await searchGraph(client, [python], { workFormat: [WorkFormat.Remote] });
    const open = await searchGraph(client, [python], {});
    const scores = new Map(open.map((hit) => [hit.vacancyId, hit.score]));
    expect(scores.get(direct.id)).toBeCloseTo(1);
    expect(scores.get(related.id)).toBeCloseTo(0.6);
    expect(scores.get(second.id)).toBeCloseTo(0.48);
    expect(scores.has(third.id)).toBe(false);
    expect(scores.has(broader.id)).toBe(false);
    expect(scores.has(expired.id)).toBe(false);
    expect(hits.map((hit) => hit.vacancyId)).not.toContain(onsite.id);
    expect(open[0]?.rank).toBe(1);
  });

  it('keeps the heavier path, a node at the weight floor, and at most 100 vacancies', async () => {
    const seen = new Date('2026-10-18T11:10:00Z');
    const origin = await insertSkill(client, 'Graph Origin', 4);
    const narrow = await insertSkill(client, 'Graph Narrow', 4);
    const weak = await insertSkill(client, 'Graph Weak', 4);
    const child = await insertSkill(client, 'Graph Child', 4);
    await insertEdge(client, origin, narrow, SkillEdgeType.Narrower, 1);
    await insertEdge(client, origin, narrow, SkillEdgeType.RelatedTo, 1);
    await insertEdge(client, origin, weak, SkillEdgeType.AlternativeOf, 0.25);
    await insertEdge(client, weak, child, SkillEdgeType.AlternativeOf, 1);
    const store = createPgVacancyStore(client);
    const heavy = await store.save(vacancy({ externalId: 'graph-heavy' }), seen);
    const floor = await store.save(vacancy({ externalId: 'graph-floor' }), seen);
    const hidden = await store.save(vacancy({ externalId: 'graph-hidden' }), seen);
    await linkSkill(client, heavy.id, narrow, SkillImportance.Required, seen);
    await linkSkill(client, floor.id, weak, SkillImportance.Required, seen);
    await linkSkill(client, hidden.id, child, SkillImportance.Required, seen);
    const hits = await searchGraph(client, [origin], {});
    const scores = new Map(hits.map((hit) => [hit.vacancyId, hit.score]));
    expect(scores.get(heavy.id)).toBeCloseTo(0.8);
    expect(scores.get(floor.id)).toBeCloseTo(0.25);
    expect(scores.has(hidden.id)).toBe(false);
    const crowd = await insertSkill(client, 'Graph Crowd', 1);
    await insertCrowd(client, crowd, seen);
    const top = await searchGraph(client, [crowd], {});
    expect(top).toHaveLength(100);
    expect(top[0]?.rank).toBe(1);
    expect(top[99]?.rank).toBe(100);
  });

  it('does not write rows when two searches run, and a dead reranker keeps RRF order', async () => {
    const before = await tableCounts(client);
    const search = portsFor(client, {
      embedQuery: async () => basisValues(1),
      searchGraph: async () => {
        throw new Error('cte down');
      },
    });
    const app = createApp({
      logger: pino({ level: 'silent' }),
      internalToken: 'secret',
      probes: [],
      search,
    });
    const down = await request(app)
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({ intent: emptyIntent('векторчанка') });
    expect(down.status).toBe(503);
    let graphCalls = 0;
    const quiet = portsFor(client, {
      embedQuery: async () => basisValues(1),
      searchGraph: async () => {
        graphCalls += 1;
        return [];
      },
      rerank: async () => {
        throw new Error('rerank down');
      },
    });
    const lexicalHits = await searchBm25(client, 'векторчанка', {});
    const denseHits = await searchDense(client, basisValues(1), {});
    const fused = fuseBranches(
      { [RetrievalBranch.Lexical]: lexicalHits, [RetrievalBranch.Dense]: denseHits },
      QueryComplexity.Simple,
      undefined,
      [RetrievalBranch.Lexical, RetrievalBranch.Dense],
    );
    const listed = await request(
      createApp({
        logger: pino({ level: 'silent' }),
        internalToken: 'secret',
        probes: [],
        search: quiet,
      }),
    )
      .post('/internal/v1/search')
      .set('X-Internal-Token', 'secret')
      .send({
        intent: emptyIntent('векторчанка'),
        options: { branches: [RetrievalBranch.Lexical, RetrievalBranch.Dense], rerank: false },
      });
    expect(graphCalls).toBe(0);
    expect(listed.status).toBe(200);
    expect(listed.body.diagnostics.rerankApplied).toBe(false);
    expect(listed.body.results.map((row: { vacancy: { id: string } }) => row.vacancy.id)).toEqual(
      fused.slice(0, 10).map((hit) => hit.vacancyId),
    );
    await Promise.all([
      request(app)
        .post('/internal/v1/search')
        .set('X-Internal-Token', 'secret')
        .send({ intent: emptyIntent('  ') }),
      request(app)
        .post('/internal/v1/search')
        .set('X-Internal-Token', 'secret')
        .send({ intent: emptyIntent('  ') }),
    ]);
    expect(await tableCounts(client)).toEqual(before);
  });
});

function portsFor(client: Client, patch: Partial<SearchPorts> = {}): SearchPorts {
  return {
    searchBm25: (query, filters) => searchBm25(client, query, filters),
    searchDense: (vector, filters) => searchDense(client, vector, filters),
    embedQuery: async () => {
      throw new Error('tei down');
    },
    resolveSkills: (mentions) =>
      resolveQuerySkills(mentions, {
        knownIds: async () => new Set<number>(),
        hits: async () => [],
        embed: async () => {
          throw new Error('tei down');
        },
      }),
    searchGraph: (ids, filters) => searchGraph(client, ids, filters),
    loadVacancies: (ids) => loadVacancies(client, ids),
    coverageFor: (skillIds, vacancyIds) => coverageFor(client, skillIds, vacancyIds),
    explainVacancies: (query) => explainVacancies(client, query),
    rerank: async () => {
      throw new Error('rerank down');
    },
    ...patch,
  };
}

function vacancy(patch: Partial<CanonicalVacancy>): CanonicalVacancy {
  const description = patch.description ?? 'описание вакансии';
  return {
    source: VacancySource.RabotaBy,
    language: 'ru',
    externalId: 'ext',
    url: 'https://rabota.by/vacancy/ext',
    title: 'Backend',
    companyName: 'рога',
    companyDisplayName: 'Рога',
    unp: null,
    region: 'Минск',
    city: 'Минск',
    description,
    descriptionRaw: description,
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
    simhash: simhash(description),
    ...patch,
  };
}

function basisValues(index: number): number[] {
  const values = Array.from({ length: EMBEDDING_WIDTH }, () => 0);
  values[index] = 1;
  return values;
}

function basis(index: number): string {
  return `[${basisValues(index).join(',')}]`;
}

async function insertChunk(
  client: Client,
  vacancyId: string,
  chunkIndex: number,
  embedding: string | null,
): Promise<void> {
  await client.query(
    `INSERT INTO vacancy_chunks (vacancy_id, chunk_index, content, token_count, embedding)
     VALUES ($1, $2, $3, 1, $4::vector)`,
    [vacancyId, chunkIndex, `chunk-${chunkIndex}`, embedding],
  );
}

async function insertCrowd(client: Client, skillId: number, seen: Date): Promise<void> {
  await client.query(
    `INSERT INTO vacancies (source, language, external_id, title, status, first_seen_at, last_seen_at)
     SELECT $1, 'ru', 'graph-crowd-' || n, 'Backend', $2, $3, $3
     FROM generate_series(0, 100) AS n`,
    [VacancySource.RabotaBy, VacancyStatus.Active, seen],
  );
  await client.query(
    `INSERT INTO vacancy_skills (vacancy_id, skill_id, importance, weight)
     SELECT v.id, $1, $2, 1 FROM vacancies v WHERE v.external_id LIKE 'graph-crowd-%'`,
    [skillId, SkillImportance.Required],
  );
}

async function insertSkill(client: Client, name: string, idf: number): Promise<number> {
  const result = await client.query(
    `INSERT INTO skills (canonical_name, skill_type, idf) VALUES ($1, 'HARD', $2) RETURNING id`,
    [name, idf],
  );
  return Number(result.rows[0]?.id);
}

async function insertEdge(
  client: Client,
  sourceSkillId: number,
  targetSkillId: number,
  edgeType: SkillEdgeType,
  weight: number,
): Promise<void> {
  await client.query(
    `INSERT INTO skill_edges (source_skill_id, target_skill_id, edge_type, weight, evidence)
     VALUES ($1, $2, $3, $4, 'TAXONOMY')`,
    [sourceSkillId, targetSkillId, edgeType, weight],
  );
}

async function linkSkill(
  client: Client,
  vacancyId: string,
  skillId: number,
  importance: SkillImportance,
  seen: Date,
): Promise<void> {
  await writeVacancySkills(
    client,
    vacancyId,
    [{ skillId, importance, weight: 1, evidenceSpan: null }],
    seen,
  );
}

async function tableCounts(client: Client): Promise<number[]> {
  const tables = ['vacancies', 'skills', 'skill_edges', 'vacancy_skills', 'users'];
  const counts: number[] = [];
  for (const table of tables) {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
    counts.push(Number(result.rows[0]?.count));
  }
  return counts;
}

async function chunkCount(client: Client, vacancyId: string): Promise<number> {
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM vacancy_chunks WHERE vacancy_id = $1`,
    [vacancyId],
  );
  return Number(result.rows[0]?.count);
}

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
