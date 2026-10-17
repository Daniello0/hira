import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  ReindexScope,
  SkillImportance,
  SkillType,
  VacancySource,
  VacancyStatus,
} from '@hira/contracts';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from '../../../../core-api/src/features/database/run-migrations';
import { simhash } from '../dedupe/simhash';
import { EmbedShapeError, vectorLiteral } from '../embed/embed-client';
import { importEscoClassification } from '../esco/import-classification';
import { planEscoImport, type EscoConcept } from '../esco/plan-esco';
import { importEscoPlan } from '../esco/import-esco';
import {
  parseEscoOccupations,
  parseEscoSkills,
  parseOccupationSkillRelations,
} from '../esco/parse-esco-csv';
import { contentHash } from '../normalize/content-hash';
import type { CanonicalVacancy } from '../normalize/normalize-vacancy';
import { clearReindex } from '../reindex/clear-reindex';
import { createPgVacancyStore } from '../store/pg-vacancy.store';
import { confirmEmbeddingDuplicates } from '../embed/confirm-duplicates';
import { writeVector } from '../embed/write-vector';
import { listPendingEmbeddings, listPendingSkills } from './pending-query';
import { loadLinkHits } from './load-link-hits';
import { refreshSkillGraph } from './refresh-skill-graph';
import { refreshVacancyCounts } from './refresh-vacancy-counts';
import { writeVacancySkills } from './write-vacancy-skills';

const DESCRIPTION = 'пишем api';
const exec = promisify(execFile);
const IMAGE = 'hira-postgres-test';
const CONTAINER = 'hira-postgres-skills-test';
const HOST_PORT = 54331;
const VECTOR = Array.from({ length: 1024 }, () => 0.01);

function canonical(patch: Partial<CanonicalVacancy> = {}): CanonicalVacancy {
  return {
    source: VacancySource.RabotaBy,
    language: 'ru',
    externalId: 'skill-1',
    url: 'https://rabota.by/vacancy/skill-1',
    title: 'Backend',
    companyName: 'рога навыки',
    companyDisplayName: 'Рога Навыки',
    unp: '100000777',
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

describe('skill graph store', () => {
  let client: Client;

  beforeAll(async () => {
    const databaseUrl = await startPostgres();
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await runMigrations(databaseUrl);
  }, 900_000);

  afterAll(async () => {
    await client?.end();
    await exec('docker', ['rm', '-f', CONTAINER]).catch(() => undefined);
  });

  it('writes skills once, keeps them on the same source text, and clears them when the description changes', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-17T12:00:00Z');
    const saved = await store.save(canonical(), seen);
    const python = await insertSkill(client, 'Python');
    const docker = await insertSkill(client, 'Docker');
    await writeVacancySkills(
      client,
      saved.id,
      [
        {
          skillId: docker,
          importance: SkillImportance.Preferred,
          weight: 0.4,
          evidenceSpan: 'нет цитаты',
        },
        {
          skillId: python,
          importance: SkillImportance.Required,
          weight: 1,
          evidenceSpan: 'пишем api',
        },
      ],
      seen,
    );
    const written = await client.query(
      `SELECT skills_text, content_hash, skills_extracted_at, embedding IS NULL AS cleared
       FROM vacancies WHERE id = $1`,
      [saved.id],
    );
    expect(written.rows[0]?.skills_text).toBe('Docker, Python');
    expect(written.rows[0]?.content_hash).toBe(
      contentHash({
        title: 'Backend',
        description: DESCRIPTION,
        skillsText: 'Docker, Python',
        conditions: '|',
      }),
    );
    expect(written.rows[0]?.cleared).toBe(true);
    expect(written.rows[0]?.skills_extracted_at).not.toBeNull();
    const quotes = await client.query(
      `SELECT evidence_span FROM vacancy_skills WHERE vacancy_id = $1 AND skill_id = $2`,
      [saved.id, docker],
    );
    expect(quotes.rows[0]?.evidence_span).toBeNull();

    await client.query(`UPDATE vacancies SET embedding = $2::vector WHERE id = $1`, [
      saved.id,
      vectorLiteral(VECTOR),
    ]);
    const skipped = await store.save(canonical(), seen);
    expect(skipped.outcome).toBe('skipped');
    const kept = await client.query(
      `SELECT skills_text, embedding IS NULL AS cleared FROM vacancies WHERE id = $1`,
      [saved.id],
    );
    expect(kept.rows[0]?.skills_text).toBe('Docker, Python');
    expect(kept.rows[0]?.cleared).toBe(false);

    await store.save(
      canonical({ description: 'совсем другое описание', contentHash: 'c'.repeat(64) }),
      seen,
    );
    const cleared = await client.query(
      `SELECT skills_text, skills_extracted_at, embedding IS NULL AS cleared,
              (SELECT COUNT(*)::int FROM vacancy_skills WHERE vacancy_id = $1) AS links
       FROM vacancies WHERE id = $1`,
      [saved.id],
    );
    expect(cleared.rows[0]).toMatchObject({
      skills_text: '',
      skills_extracted_at: null,
      cleared: true,
      links: 0,
    });
    await expect(
      writeVacancySkills(
        client,
        saved.id,
        [
          {
            skillId: python,
            importance: SkillImportance.Required,
            weight: 1.2,
            evidenceSpan: null,
          },
        ],
        seen,
      ),
    ).rejects.toThrow();
  });

  it('lists skill work before embed work and rejects a short vector', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-17T13:00:00Z');
    const saved = await store.save(canonical({ externalId: 'pending-1', unp: '100000778' }), seen);
    const skills = await listPendingSkills(client, VacancySource.RabotaBy, 20);
    expect(skills.map((row) => row.id)).toContain(saved.id);
    const early = await listPendingEmbeddings(client, VacancySource.RabotaBy, 32);
    expect(early.map((row) => row.id)).not.toContain(saved.id);
    const skillId = await insertSkill(client, 'Go');
    await writeVacancySkills(
      client,
      saved.id,
      [{ skillId, importance: SkillImportance.Mentioned, weight: 0.2, evidenceSpan: null }],
      seen,
    );
    const embed = await listPendingEmbeddings(client, VacancySource.RabotaBy, 32);
    expect(embed.map((row) => row.id)).toContain(saved.id);
    await expect(writeVector(client, 'vacancies', saved.id, [0.1, 0.2])).rejects.toThrow(
      EmbedShapeError,
    );
    const still = await client.query(
      `SELECT embedding IS NULL AS empty FROM vacancies WHERE id = $1`,
      [saved.id],
    );
    expect(still.rows[0]?.empty).toBe(true);
    await writeVector(client, 'vacancies', saved.id, VECTOR);
    const done = await listPendingEmbeddings(client, VacancySource.RabotaBy, 32);
    expect(done.map((row) => row.id)).not.toContain(saved.id);
  });

  it('imports an ESCO fixture, counts vacancies, and does not drop taxonomy edges or idf', async () => {
    const concepts: EscoConcept[] = [
      {
        uri: 'http://esco/skill/python',
        preferredLabel: 'Python programming',
        altLabels: ['py'],
        skillType: SkillType.Hard,
        broaderUri: 'http://esco/skill/programming',
      },
      {
        uri: 'http://esco/skill/programming',
        preferredLabel: 'Programming',
        altLabels: [],
        skillType: SkillType.Domain,
        broaderUri: null,
      },
    ];
    await importEscoPlan(
      client,
      planEscoImport(
        concepts,
        new Map([['http://esco/skill/python', 'Программирование на Python']]),
      ),
    );
    const aliases = await client.query(
      `SELECT a.alias, a.lang, a.source::text
       FROM skill_aliases a JOIN skills s ON s.id = a.skill_id
       WHERE s.esco_uri = 'http://esco/skill/python' ORDER BY a.lang, a.alias`,
    );
    expect(aliases.rows).toEqual([
      { alias: 'py', lang: 'en', source: 'ESCO' },
      { alias: 'Программирование на Python', lang: 'ru', source: 'ESCO_TRANSLATED' },
    ]);
    const edges = await client.query(
      `SELECT edge_type::text, weight, evidence FROM skill_edges e
       JOIN skills s ON s.id = e.source_skill_id
       WHERE s.esco_uri = 'http://esco/skill/python'`,
    );
    expect(edges.rows).toEqual([{ edge_type: 'BROADER', weight: 1, evidence: 'TAXONOMY' }]);
    const occupations = await client.query(`SELECT COUNT(*)::int AS count FROM occupations`);
    expect(occupations.rows[0]?.count).toBe(0);

    const python = await client.query(
      `SELECT id FROM skills WHERE esco_uri = 'http://esco/skill/python'`,
    );
    const programming = await client.query(
      `SELECT id FROM skills WHERE esco_uri = 'http://esco/skill/programming'`,
    );
    const pythonId = Number(python.rows[0]?.id);
    const programmingId = Number(programming.rows[0]?.id);
    await client.query(
      `INSERT INTO skill_edges (source_skill_id, target_skill_id, edge_type, weight, evidence)
       VALUES ($1, $2, 'RELATED_TO', 0.5, 'COOCCURRENCE')`,
      [pythonId, programmingId],
    );
    await client.query(`UPDATE skills SET idf = 4 WHERE id = $1`, [pythonId]);
    const hits = await loadLinkHits(client, 'py', null);
    expect(hits.some((hit) => hit.skillId === pythonId && hit.exactAlias)).toBe(true);

    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-17T14:00:00Z');
    const first = await store.save(
      canonical({ externalId: 'count-1', unp: '100000779', companyName: 'счёт один' }),
      seen,
    );
    const second = await store.save(
      canonical({ externalId: 'count-2', unp: '100000780', companyName: 'счёт два' }),
      seen,
    );
    await writeVacancySkills(
      client,
      first.id,
      [{ skillId: pythonId, importance: SkillImportance.Required, weight: 1, evidenceSpan: null }],
      seen,
    );
    await writeVacancySkills(
      client,
      second.id,
      [{ skillId: pythonId, importance: SkillImportance.Required, weight: 1, evidenceSpan: null }],
      seen,
    );
    await refreshVacancyCounts(client);
    const counted = await client.query(`SELECT vacancy_count, idf FROM skills WHERE id = $1`, [
      pythonId,
    ]);
    expect(Number(counted.rows[0]?.vacancy_count)).toBe(2);
    expect(Number(counted.rows[0]?.idf)).toBe(4);
    const related = await client.query(
      `SELECT COUNT(*)::int AS count FROM skill_edges
       WHERE edge_type = 'RELATED_TO' AND evidence = 'COOCCURRENCE'`,
    );
    expect(related.rows[0]?.count).toBe(1);

    await clearReindex(client, ReindexScope.Embeddings, [first.id]);
    const afterEmbed = await client.query(
      `SELECT embedding IS NULL AS empty, skills_extracted_at IS NULL AS skills_cleared
       FROM vacancies WHERE id = $1`,
      [first.id],
    );
    expect(afterEmbed.rows[0]).toMatchObject({ empty: true, skills_cleared: false });
    const skillStill = await client.query(
      `SELECT COUNT(*)::int AS count FROM skills WHERE id = $1`,
      [pythonId],
    );
    expect(skillStill.rows[0]?.count).toBe(1);
    await clearReindex(client, ReindexScope.Skills, [first.id]);
    const afterSkills = await client.query(
      `SELECT skills_extracted_at IS NULL AS skills_cleared FROM vacancies WHERE id = $1`,
      [first.id],
    );
    expect(afterSkills.rows[0]?.skills_cleared).toBe(true);
  });

  it('marks a cross-source copy by cosine and leaves a different city alone', async () => {
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-17T15:00:00Z');
    const later = new Date('2026-10-17T15:05:00Z');
    const shared = {
      title: 'Дизайнер',
      companyName: 'общая студия',
      companyDisplayName: 'Общая студия',
      unp: '100000781',
      city: 'Минск',
      region: 'Минск',
    };
    const first = await store.save(
      canonical({ ...shared, externalId: 'cos-1', description: 'первый текст про дизайн' }),
      seen,
    );
    const second = await store.save(
      canonical({
        ...shared,
        source: VacancySource.HabrCareer,
        externalId: 'cos-2',
        description: 'второй совсем иной текст',
      }),
      later,
    );
    const otherCity = await store.save(
      canonical({
        ...shared,
        source: VacancySource.Gsz,
        externalId: 'cos-3',
        city: 'Брест',
        region: 'Брестская',
        description: 'третий текст',
      }),
      seen,
    );
    await writeVector(client, 'vacancies', first.id, VECTOR);
    await writeVector(client, 'vacancies', second.id, VECTOR);
    await writeVector(client, 'vacancies', otherCity.id, VECTOR);
    const marked = await confirmEmbeddingDuplicates(client);
    expect(marked).toBeGreaterThanOrEqual(1);
    const copy = await client.query(
      `SELECT v.status::text AS status, d.detected_by
       FROM vacancies v
       LEFT JOIN vacancy_duplicates d ON d.duplicate_vacancy_id = v.id
       WHERE v.external_id = 'cos-2'`,
    );
    expect(copy.rows[0]?.status).toBe(VacancyStatus.Duplicate);
    expect(copy.rows[0]?.detected_by).toBe('EMBEDDING');
    const brest = await client.query(
      `SELECT status::text AS status FROM vacancies WHERE external_id = 'cos-3'`,
    );
    expect(brest.rows[0]?.status).toBe(VacancyStatus.Active);
  });

  it('rebuilds co-occurrence edges and imports occupations without assigning skill types', async () => {
    const alpha = await insertSkill(client, 'AlphaGraph');
    const beta = await insertSkill(client, 'BetaGraph');
    const store = createPgVacancyStore(client);
    const seen = new Date('2026-10-17T16:00:00Z');
    for (let index = 0; index < 5; index += 1) {
      const saved = await store.save(
        canonical({
          externalId: `graph-${index}`,
          unp: `10000081${index}`,
          companyName: `граф ${index}`,
          companyDisplayName: `Граф ${index}`,
          title: `Graph ${index}`,
        }),
        seen,
      );
      await writeVacancySkills(
        client,
        saved.id,
        [
          { skillId: alpha, importance: SkillImportance.Required, weight: 1, evidenceSpan: null },
          { skillId: beta, importance: SkillImportance.Required, weight: 1, evidenceSpan: null },
        ],
        seen,
      );
    }
    await client.query(
      `INSERT INTO skill_edges (source_skill_id, target_skill_id, edge_type, weight, evidence)
       VALUES ($1, $2, 'RELATED_TO', 0.1, 'COOCCURRENCE')`,
      [alpha, beta],
    );
    await refreshSkillGraph(client);
    const edges = await client.query(
      `SELECT source_skill_id, target_skill_id, weight
       FROM skill_edges
       WHERE evidence = 'COOCCURRENCE' AND edge_type = 'RELATED_TO'
         AND source_skill_id IN ($1, $2) AND target_skill_id IN ($1, $2)`,
      [alpha, beta],
    );
    expect(edges.rows).toHaveLength(2);
    expect(Number(edges.rows[0]?.weight)).toBeCloseTo(1, 5);
    expect(Number(edges.rows[1]?.weight)).toBeCloseTo(1, 5);
    const taxonomy = await client.query(
      `SELECT COUNT(*)::int AS count FROM skill_edges WHERE evidence = 'TAXONOMY'`,
    );
    expect(taxonomy.rows[0]?.count).toBeGreaterThan(0);

    const imported = await importEscoClassification(client, {
      occupations: parseEscoOccupations(
        [
          'Concept URI,Concept type,Concept PT,Definition',
          'http://esco/occ/dev,OC,Developer,Writes software',
          'http://esco/occ/group,OG,Managers,',
        ].join('\n'),
      ),
      skills: parseEscoSkills(
        [
          'conceptUri,conceptType,skillType,preferredLabel,altLabels,definition',
          'http://esco/skill/new,SK,knowledge,New skill,ns,A knowledge concept',
          'http://esco/skill/odd,SK,,Odd skill,,',
          'http://esco/group/folder,SG,knowledge,Folder,,',
        ].join('\n'),
      ),
      links: parseOccupationSkillRelations(
        [
          'occupationUri,relationType,skillUri',
          'http://esco/occ/dev,essential,http://esco/skill/python',
          'http://esco/occ/dev,optional,http://esco/skill/new',
        ].join('\n'),
      ),
      broader: [{ uri: 'http://esco/skill/new', broaderUri: 'http://esco/skill/python' }],
      translations: [{ uri: 'http://esco/skill/new', label: 'Новый навык' }],
    });
    expect(imported).toMatchObject({
      occupations: 1,
      skillsImported: 1,
      skillsSkipped: 1,
      links: 2,
    });
    const importedSkill = await client.query(
      `SELECT skill_type::text AS type FROM skills WHERE esco_uri = 'http://esco/skill/new'`,
    );
    expect(importedSkill.rows[0]?.type).toBe('DOMAIN');
    const alias = await client.query(
      `SELECT a.alias, a.source::text AS source
       FROM skill_aliases a
       JOIN skills s ON s.id = a.skill_id
       WHERE s.esco_uri = 'http://esco/skill/new' AND a.lang = 'en'`,
    );
    expect(alias.rows).toEqual([{ alias: 'ns', source: 'ESCO' }]);
    const skipped = await client.query(
      `SELECT COUNT(*)::int AS count FROM skills WHERE esco_uri = 'http://esco/skill/odd'`,
    );
    expect(skipped.rows[0]?.count).toBe(0);
    const typicality = await client.query(
      `SELECT os.typicality
       FROM occupation_skills os
       JOIN occupations o ON o.id = os.occupation_id
       JOIN skills s ON s.id = os.skill_id
       WHERE o.esco_uri = 'http://esco/occ/dev' AND s.esco_uri = 'http://esco/skill/python'`,
    );
    expect(Number(typicality.rows[0]?.typicality)).toBe(1);
    const optional = await client.query(
      `SELECT os.typicality
       FROM occupation_skills os
       JOIN occupations o ON o.id = os.occupation_id
       JOIN skills s ON s.id = os.skill_id
       WHERE o.esco_uri = 'http://esco/occ/dev' AND s.esco_uri = 'http://esco/skill/new'`,
    );
    expect(Number(optional.rows[0]?.typicality)).toBe(0.5);
    const hierarchy = await client.query(
      `SELECT edge_type::text AS type, weight, evidence
       FROM skill_edges e
       JOIN skills source ON source.id = e.source_skill_id
       JOIN skills target ON target.id = e.target_skill_id
       WHERE source.esco_uri = 'http://esco/skill/new'
         AND target.esco_uri = 'http://esco/skill/python'`,
    );
    expect(hierarchy.rows).toEqual([{ type: 'BROADER', weight: 1, evidence: 'TAXONOMY' }]);
    const russian = await client.query(
      `SELECT a.alias, a.lang, a.source::text AS source
       FROM skill_aliases a
       JOIN skills s ON s.id = a.skill_id
       WHERE s.esco_uri = 'http://esco/skill/new' AND a.lang = 'ru'`,
    );
    expect(russian.rows).toEqual([{ alias: 'Новый навык', lang: 'ru', source: 'ESCO_TRANSLATED' }]);
  });
});

async function insertSkill(db: Client, name: string): Promise<number> {
  const result = await db.query(
    `INSERT INTO skills (canonical_name, skill_type) VALUES ($1, 'HARD') RETURNING id`,
    [name],
  );
  return Number(result.rows[0]?.id);
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
    'POSTGRES_USER=hira',
    '-e',
    'POSTGRES_PASSWORD=hira',
    '-e',
    'POSTGRES_DB=hira',
    '-p',
    `${HOST_PORT}:5432`,
    IMAGE,
    'postgres',
    '-c',
    'shared_preload_libraries=pg_textsearch',
    '-c',
    'hnsw.iterative_scan=relaxed_order',
  ]);
  const databaseUrl = `postgresql://hira:hira@127.0.0.1:${HOST_PORT}/hira`;
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
