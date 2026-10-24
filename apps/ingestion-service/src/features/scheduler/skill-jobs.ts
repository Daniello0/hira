import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { Pool } from 'pg';
import type { VacancySource } from '@hira/contracts';
import { IngestionStatus } from '@hira/contracts';
import { ENV } from '../../common/constants/app.constants';
import { readInternalToken } from '../../common/utils/env';
import { readCountEnv } from '../../common/utils/env-flags';
import type { DailyCounter } from '../budget/daily-counter';
import { confirmEmbeddingDuplicates } from '../embed/confirm-duplicates';
import {
  DEFAULT_LLM_DAILY_BUDGET,
  EMBED_QUEUE,
  EXTRACT_SKILLS_QUEUE,
  GRAPH_QUEUE,
  INGESTION_ENV,
  JOB_EMBED,
  JOB_EXTRACT_SKILLS,
  JOB_GRAPH,
  LLM_BUDGET_KEY,
  QUEUE_PREFIX,
  SKILL_BATCH_SIZE,
} from '../ingestion.constants';
import { requestEmbeddings, type EmbedPost } from '../embed/embed-client';
import { embedPendingChunks } from '../embed/embed-chunks';
import { surfaceVector } from '../embed/surface-vector';
import { importEscoClassification } from '../esco/import-classification';
import { loadEscoDirectory } from '../esco/load-esco-directory';
import { EMBED_CLAIM_LIMIT, SKILL_CLAIM_LIMIT } from '../embed/pending-kind';
import { listUnembeddedSkills } from '../embed/unembedded-skills';
import { writeVector } from '../embed/write-vector';
import { requestExtractedSkillsBatch, type ExtractHttp } from '../llm-client/extract-client';
import { createBatchExtractor } from '../skills/batch-extractor';
import { ensureReviewSkill } from '../skills/ensure-skill';
import { loadLinkHits } from '../skills/load-link-hits';
import {
  listPendingEmbeddings,
  listPendingSkills,
  recordSkillFailure,
  tryLockJob,
  unlockJob,
} from '../skills/pending-query';
import { processSkillVacancies, type SkillRunCounts } from '../skills/process-skills';
import { refreshSkillGraph } from '../skills/refresh-skill-graph';
import { writeVacancySkills } from '../skills/write-vacancy-skills';
import { createPgRunStore, type RunFinish } from '../store/pg-run.store';
import type { SqlClient } from '../store/sql-client';
import { isSkillExtractionEnabled } from './skill-flags';
import type { SkillIndexJob, SkillIndexQueue } from './skill-schedules';

export interface SkillWorkers {
  queue: SkillIndexQueue;
  close(): Promise<void>;
}

/** Opens the extract, embed, and graph queues. Cron only enqueues. */
export function startSkillWorkers(
  pool: Pool,
  redisUrl: string,
  logger: Logger,
  budget: DailyCounter,
): SkillWorkers {
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const names = [EXTRACT_SKILLS_QUEUE, EMBED_QUEUE, GRAPH_QUEUE];
  const queues = names.map((name) => queueOf(name, connection));
  const workerConnections = names.map(() => new Redis(redisUrl, { maxRetriesPerRequest: null }));
  const workers = names.map((name, index) =>
    workerOf(name, workerConnections[index] as Redis, (job) =>
      runQueued(pool, job, logger, budget),
    ),
  );
  return {
    queue: {
      add: async (name, job, options) => {
        const target = queues.find((item) => item.name === name);
        if (target === undefined) throw new Error(`unknown queue ${name}`);
        await target.add(job.jobType, job, cronJobOptions(options?.jobId));
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

/** A cron tick gets a fixed id and leaves no record, so a slow tick is not queued twice. */
export function cronJobOptions(jobId: string | undefined) {
  if (jobId === undefined) return undefined;
  return { jobId, removeOnComplete: true, removeOnFail: true };
}

async function runQueued(
  pool: Pool,
  job: SkillIndexJob,
  logger: Logger,
  budget: DailyCounter,
): Promise<void> {
  if (job.jobType === JOB_GRAPH || job.source === undefined) {
    await runGraphRefresh(pool, process.env);
    return;
  }
  const runs = createPgRunStore(pool);
  const run = await runs.start(job.source, job.jobType, new Date());
  const client = await pool.connect();
  try {
    const result = await dispatch(client, job.source, job.jobType, budget);
    await runs.finish(run.id, result);
  } catch (error) {
    logger.error({ err: error, runId: run.id }, 'skill job failed');
    await runs.finish(run.id, failed(errorText(error), new Date()));
  } finally {
    client.release();
  }
}

function dispatch(
  client: SqlClient,
  source: VacancySource,
  jobType: string,
  budget: DailyCounter,
): Promise<RunFinish> {
  const now = new Date();
  if (jobType === JOB_EMBED) return runEmbedding(client, source, process.env, now);
  if (jobType === JOB_EXTRACT_SKILLS) {
    return runSkillExtraction(client, source, process.env, now, budget);
  }
  return Promise.resolve(failed(`unsupported job ${jobType}`, now));
}

/**
 * Extracts skills for one source in batches of five vacancies per LLM call, under the daily
 * `LLM_DAILY_BUDGET`. One run per source at a time; a 429 or a spent budget ends the tick.
 */
export async function runSkillExtraction(
  client: SqlClient,
  source: VacancySource,
  env: NodeJS.ProcessEnv,
  now: Date,
  budget: DailyCounter | null = null,
): Promise<RunFinish> {
  if (!isSkillExtractionEnabled(env)) return notice('SKILL_EXTRACTION_ENABLED=false', now);
  const baseUrl = env[ENV.llmServiceUrl]?.trim() ?? '';
  if (baseUrl.length === 0) return failed('LLM_SERVICE_URL is not set', now);
  const lockKey = `${JOB_EXTRACT_SKILLS}:${source}`;
  if (!(await tryLockJob(client, lockKey))) {
    return notice(`another ${JOB_EXTRACT_SKILLS} run holds ${source}`, now);
  }
  try {
    const counts = await extractClaimed(client, source, env, now, budget);
    return finishSkills(counts, now);
  } finally {
    await unlockJob(client, lockKey);
  }
}

async function extractClaimed(
  client: SqlClient,
  source: VacancySource,
  env: NodeJS.ProcessEnv,
  now: Date,
  budget: DailyCounter | null,
): Promise<SkillRunCounts> {
  const extractor = createBatchExtractor({
    batchSize: SKILL_BATCH_SIZE,
    request: (vacancies) =>
      requestExtractedSkillsBatch(liveExtract(), llmUrl(env), readInternalToken(env), vacancies),
    allowCall: () => spendLlmCall(budget, env),
  });
  return processSkillVacancies({
    claim: async () => {
      const rows = await listPendingSkills(client, source, SKILL_CLAIM_LIMIT);
      extractor.prime(rows);
      return rows;
    },
    extract: (vacancy) => extractor.extract(vacancy),
    hits: (surface) => linkHits(client, env, surface),
    ensureSkill: (surface, skill) => ensureReviewSkill(client, surface, skill),
    write: (vacancyId, skills) => writeVacancySkills(client, vacancyId, skills, now),
    markFailed: (vacancy) => recordSkillFailure(client, vacancy.id),
  });
}

function spendLlmCall(budget: DailyCounter | null, env: NodeJS.ProcessEnv): Promise<boolean> {
  if (budget === null) return Promise.resolve(true);
  const limit = readCountEnv(env, INGESTION_ENV.llmDailyBudget, DEFAULT_LLM_DAILY_BUDGET);
  return budget.take(LLM_BUDGET_KEY, limit);
}

function llmUrl(env: NodeJS.ProcessEnv): string {
  return env[ENV.llmServiceUrl]?.trim() ?? '';
}

function finishSkills(counts: SkillRunCounts, now: Date): RunFinish {
  const result = finish(counts.updated, counts.failed, counts.errors, now);
  return counts.halted === undefined ? result : { ...result, status: IngestionStatus.Partial };
}

/** A run that did no work on purpose: success, with the reason in the errors list. */
function notice(message: string, now: Date): RunFinish {
  return finish(0, 0, [{ message }], now);
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
  const duplicates = vacancies.updated > 0 ? await confirmDuplicates(client) : noErrors();
  const chunks = await embedPendingChunks(client, source, baseUrl, liveEmbed());
  const skills = await embedSkillNames(client, baseUrl);
  const failedCount = vacancies.failed + duplicates.failed + chunks.failed + skills.failed;
  return finish(
    vacancies.updated + chunks.updated + skills.updated,
    failedCount,
    [...vacancies.errors, ...duplicates.errors, ...chunks.errors],
    now,
  );
}

/** Cross-source copies whose fresh vectors meet the 0.93 cosine threshold (Wiki/03 §2.3). */
async function confirmDuplicates(
  client: SqlClient,
): Promise<{ failed: number; errors: Array<{ message: string }> }> {
  try {
    await confirmEmbeddingDuplicates(client);
    return noErrors();
  } catch (error) {
    return { failed: 1, errors: [{ message: `duplicate check: ${errorText(error)}` }] };
  }
}

function noErrors(): { failed: number; errors: Array<{ message: string }> } {
  return { failed: 0, errors: [] };
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
