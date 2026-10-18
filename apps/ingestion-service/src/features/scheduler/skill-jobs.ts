import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Pool } from 'pg';
import type { VacancySource } from '@hira/contracts';
import { IngestionStatus } from '@hira/contracts';
import { ENV } from '../../common/constants/app.constants';
import { readInternalToken } from '../../common/utils/env';
import {
  EMBED_QUEUE,
  EXTRACT_SKILLS_QUEUE,
  GRAPH_QUEUE,
  JOB_EMBED,
  JOB_EXTRACT_SKILLS,
  JOB_GRAPH,
  QUEUE_PREFIX,
} from '../ingestion.constants';
import { requestEmbeddings, type EmbedPost } from '../embed/embed-client';
import { embedPendingChunks } from '../embed/embed-chunks';
import { surfaceVector } from '../embed/surface-vector';
import { importEscoClassification } from '../esco/import-classification';
import { loadEscoDirectory } from '../esco/load-esco-directory';
import { EMBED_CLAIM_LIMIT, SKILL_CLAIM_LIMIT } from '../embed/pending-kind';
import { listUnembeddedSkills } from '../embed/unembedded-skills';
import { writeVector } from '../embed/write-vector';
import { requestExtractedSkills, type ExtractHttp } from '../llm-client/extract-client';
import { ensureReviewSkill } from '../skills/ensure-skill';
import { loadLinkHits } from '../skills/load-link-hits';
import { listPendingEmbeddings, listPendingSkills } from '../skills/pending-query';
import { processSkillVacancies } from '../skills/process-skills';
import { refreshSkillGraph } from '../skills/refresh-skill-graph';
import { writeVacancySkills } from '../skills/write-vacancy-skills';
import { createPgRunStore, type RunFinish } from '../store/pg-run.store';
import type { SqlClient } from '../store/sql-client';
import type { SkillIndexJob, SkillIndexQueue } from './skill-schedules';

export interface SkillWorkers {
  queue: SkillIndexQueue;
  close(): Promise<void>;
}

/** Opens the extract, embed, and graph queues. Cron only enqueues. */
export function startSkillWorkers(pool: Pool, redisUrl: string, logger: Logger): SkillWorkers {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const names = [EXTRACT_SKILLS_QUEUE, EMBED_QUEUE, GRAPH_QUEUE];
  const queues = names.map((name) => queueOf(name, connection));
  const workerConnections = names.map(() => new Redis(redisUrl, { maxRetriesPerRequest: null }));
  const workers = names.map((name, index) =>
    workerOf(name, workerConnections[index] as Redis, (job) => runQueued(pool, job, logger)),
  );
  return {
    queue: {
      add: async (name, job) => {
        const target = queues.find((item) => item.name === name);
        if (target === undefined) throw new Error(`unknown queue ${name}`);
        await target.add(job.jobType, job);
      },
    },
    close: () => closeWorkers(workers, queues, [connection, ...workerConnections]),
  };
}

async function closeWorkers(
  workers: Array<Worker<SkillIndexJob>>,
  queues: Array<Queue<SkillIndexJob>>,
  connections: Redis[],
): Promise<void> {
  await Promise.all(workers.map((worker) => worker.close()));
  await Promise.all(queues.map((item) => item.close()));
  await Promise.all(connections.map((item) => item.quit()));
}

function queueOf(name: string, connection: Redis): Queue<SkillIndexJob> {
  return new Queue(name, { connection, prefix: QUEUE_PREFIX });
}

function workerOf(
  name: string,
  connection: Redis,
  handler: (job: SkillIndexJob) => Promise<void>,
): Worker<SkillIndexJob> {
  return new Worker(name, (job) => handler(job.data), { connection, prefix: QUEUE_PREFIX });
}

async function runQueued(pool: Pool, job: SkillIndexJob, logger: Logger): Promise<void> {
  if (job.jobType === JOB_GRAPH || job.source === undefined) {
    await runGraphRefresh(pool, process.env);
    return;
  }
  const runs = createPgRunStore(pool);
  const run = await runs.start(job.source, job.jobType, new Date());
  const client = await pool.connect();
  try {
    const result = await dispatch(client, job.source, job.jobType);
    await runs.finish(run.id, result);
  } catch (error) {
    logger.error({ err: error, runId: run.id }, 'skill job failed');
    await runs.finish(run.id, failed(errorText(error), new Date()));
  } finally {
    client.release();
  }
}

function dispatch(client: SqlClient, source: VacancySource, jobType: string): Promise<RunFinish> {
  const now = new Date();
  if (jobType === JOB_EMBED) return runEmbedding(client, source, process.env, now);
  if (jobType === JOB_EXTRACT_SKILLS) return runSkillExtraction(client, source, process.env, now);
  return Promise.resolve(failed(`unsupported job ${jobType}`, now));
}

/** Extracts skills for one source and records the run counters. */
export async function runSkillExtraction(
  client: SqlClient,
  source: VacancySource,
  env: NodeJS.ProcessEnv,
  now: Date,
): Promise<RunFinish> {
  const baseUrl = env[ENV.llmServiceUrl]?.trim() ?? '';
  if (baseUrl.length === 0) return failed('LLM_SERVICE_URL is not set', now);
  const counts = await processSkillVacancies({
    claim: () => listPendingSkills(client, source, SKILL_CLAIM_LIMIT),
    extract: (vacancy) =>
      requestExtractedSkills(liveExtract(), baseUrl, readInternalToken(env), {
        id: vacancy.id,
        title: vacancy.title,
        description: vacancy.description,
      }),
    hits: (surface) => linkHits(client, env, surface),
    ensureSkill: (surface, skill) => ensureReviewSkill(client, surface, skill),
    write: (vacancyId, skills) => writeVacancySkills(client, vacancyId, skills, now),
  });
  return finish(counts.updated, counts.failed, counts.errors, now);
}

/** Embeds pending vacancies for one source, then skill names that still have no vector. */
export async function runEmbedding(
  client: SqlClient,
  source: VacancySource,
  env: NodeJS.ProcessEnv,
  now: Date,
): Promise<RunFinish> {
  const baseUrl = env[ENV.teiEmbedUrl]?.trim() ?? '';
  if (baseUrl.length === 0) return failed('TEI_EMBED_URL is not set', now);
  const vacancies = await embedVacancies(client, source, baseUrl);
  const chunks = await embedPendingChunks(client, source, baseUrl, liveEmbed());
  const skills = await embedSkillNames(client, baseUrl);
  const failedCount = vacancies.failed + chunks.failed + skills.failed;
  return finish(
    vacancies.updated + chunks.updated + skills.updated,
    failedCount,
    [...vacancies.errors, ...chunks.errors],
    now,
  );
}

/** Imports `ESCO_DIR` when it is set, then recounts skills and replaces RELATED_TO edges. */
export async function runGraphRefresh(client: SqlClient, env: NodeJS.ProcessEnv): Promise<void> {
  await importConfiguredEsco(client, env);
  await refreshSkillGraph(client);
}

async function importConfiguredEsco(client: SqlClient, env: NodeJS.ProcessEnv): Promise<void> {
  const dir = env[ENV.escoDir]?.trim() ?? '';
  if (dir.length === 0) return;
  const dump = await loadEscoDirectory(dir);
  if (dump === null) return;
  await importEscoClassification(client, dump);
}

async function linkHits(client: SqlClient, env: NodeJS.ProcessEnv, surface: string) {
  const baseUrl = env[ENV.teiEmbedUrl]?.trim() ?? '';
  const vector = baseUrl.length === 0 ? null : await surfaceVector(liveEmbed(), baseUrl, surface);
  return loadLinkHits(client, surface, vector);
}

async function embedVacancies(
  client: SqlClient,
  source: VacancySource,
  baseUrl: string,
): Promise<{ updated: number; failed: number; errors: Array<{ message: string }> }> {
  try {
    const rows = await listPendingEmbeddings(client, source, EMBED_CLAIM_LIMIT);
    const vectors = await embedTexts(
      baseUrl,
      rows.map((row) => `${row.title}\n${row.description}`),
    );
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const vector = vectors[index];
      if (row === undefined || vector === undefined) continue;
      await writeVector(client, 'vacancies', row.id, vector);
    }
    return { updated: rows.length, failed: 0, errors: [] };
  } catch (error) {
    return { updated: 0, failed: 1, errors: [{ message: errorText(error) }] };
  }
}

async function embedSkillNames(
  client: SqlClient,
  baseUrl: string,
): Promise<{ updated: number; failed: number }> {
  try {
    const rows = await listUnembeddedSkills(client, EMBED_CLAIM_LIMIT);
    const vectors = await embedTexts(
      baseUrl,
      rows.map((row) => row.name),
    );
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const vector = vectors[index];
      if (row === undefined || vector === undefined) continue;
      await writeVector(client, 'skills', row.id, vector);
    }
    return { updated: rows.length, failed: 0 };
  } catch {
    return { updated: 0, failed: 1 };
  }
}

async function embedTexts(baseUrl: string, inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];
  return requestEmbeddings(liveEmbed(), baseUrl, inputs);
}

function liveExtract(): ExtractHttp {
  return {
    post: async (url, token, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Internal-Token': token },
        body: JSON.stringify(body),
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
  };
}

function liveEmbed(): EmbedPost {
  return {
    post: async (url, body) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`embed failed with status ${response.status}`);
      return response.json() as Promise<unknown>;
    },
  };
}

function finish(
  updated: number,
  failed: number,
  errors: Array<{ externalId?: string; message: string }>,
  now: Date,
): RunFinish {
  const status = failed > 0 ? IngestionStatus.Partial : IngestionStatus.Success;
  return {
    status,
    fetched: updated + failed,
    created: 0,
    updated,
    skipped: 0,
    failed,
    errors: errors.length === 0 ? null : errors,
    finishedAt: now,
  };
}

function failed(message: string, now: Date): RunFinish {
  return finish(0, 1, [{ message }], now);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'embed failed';
}
