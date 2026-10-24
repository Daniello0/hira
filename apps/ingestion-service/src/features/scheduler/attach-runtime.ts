import { Queue, Worker } from 'bullmq';
import type { Router } from 'express';
import { Redis } from 'ioredis';
import cron from 'node-cron';
import type { Logger } from 'pino';
import type { Pool, PoolClient } from 'pg';
import { IngestionStatus, type VacancySource } from '@hira/contracts';
import { createRedisDailyCounter, type DailyCounter } from '../budget/daily-counter';
import { dailyRequestCap } from '../connectors/registry';
import {
  INGEST_QUEUE,
  JOB_EMBED,
  JOB_EXTRACT_SKILLS,
  JOB_GRAPH,
  QUEUE_PREFIX,
} from '../ingestion.constants';
import { clearReindex } from '../reindex/clear-reindex';
import { createRunsRouter } from '../runs/runs.router';
import type { HttpGet } from '../connectors/collect-source';
import { createDailyRates, fetchNbrbRates } from '../normalize/nbrb-rates';
import { performIngest } from '../store/perform-ingest';
import { createPgRunStore } from '../store/pg-run.store';
import {
  cronJobOptions,
  runEmbedding,
  runGraphRefresh,
  runSkillExtraction,
  startSkillWorkers,
} from './skill-jobs';
import { registerSkillIndexCron } from './skill-schedules';
import type { IngestJob, IngestQueue } from './schedules';
import { registerIngestionCron } from './schedules';

export interface Runtime {
  router: Router;
  close(): Promise<void>;
}

/** Starts the run API, the six-hour cron, and the BullMQ worker. */
export function attachIngestionRuntime(
  pool: Pool,
  redisUrl: string,
  limit: number,
  logger: Logger,
): Runtime {
  const runs = createPgRunStore(pool);
  const queueConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const workerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null });
  const budget = createRedisDailyCounter(queueConnection);
  const queue = new Queue<IngestJob>(INGEST_QUEUE, {
    connection: queueConnection,
    prefix: QUEUE_PREFIX,
  });
  const rates = createDailyRates(
    () => fetchNbrbRates(liveHttp()),
    () => new Date(),
  );
  const worker = new Worker<IngestJob>(
    INGEST_QUEUE,
    (job) => handleJob(pool, job.data, { limit, logger, rates, budget }),
    {
      connection: workerConnection,
      prefix: QUEUE_PREFIX,
    },
  );
  registerIngestionCron(cron, queueAdapter(queue));
  const skills = startSkillWorkers(pool, redisUrl, logger, budget);
  registerSkillIndexCron(cron, skills.queue);
  worker.on('failed', (job, error) =>
    logger.error({ err: error, jobId: job?.id }, 'ingestion job failed'),
  );
  return {
    router: runsRouter(runs, queue, pool),
    close: () => closeAll(worker, queue, queueConnection, workerConnection, skills.close),
  };
}

function runsRouter(
  runs: ReturnType<typeof createPgRunStore>,
  queue: Queue<IngestJob>,
  pool: Pool,
): Router {
  return createRunsRouter({
    runs,
    queue: queueAdapter(queue),
    now: () => new Date(),
    reindex: (command) => clearReindex(pool, command.scope, command.vacancyIds),
  });
}

function queueAdapter(queue: Queue<IngestJob>): IngestQueue {
  return {
    add: async (job, options) => {
      await queue.add(job.jobType, job, cronJobOptions(options?.jobId));
    },
  };
}

interface JobContext {
  limit: number;
  logger: Logger;
  rates: () => Promise<Record<string, number>>;
  budget: DailyCounter;
}

async function handleJob(pool: Pool, job: IngestJob, context: JobContext): Promise<void> {
  const runs = createPgRunStore(pool);
  const runId = job.runId ?? (await runs.start(job.source, job.jobType, new Date())).id;
  const client = await pool.connect();
  try {
    await runs.finish(runId, await runOne(client, job, context));
  } catch (error) {
    context.logger.error({ err: error, runId }, 'ingestion run failed');
    await failRun(runs, runId, error);
  } finally {
    client.release();
  }
}

async function runOne(client: PoolClient, job: IngestJob, context: JobContext) {
  const now = new Date();
  if (job.jobType === JOB_EXTRACT_SKILLS) {
    return runSkillExtraction(client, job.source, process.env, now, context.budget);
  }
  if (job.jobType === JOB_EMBED) return runEmbedding(client, job.source, process.env, now);
  if (job.jobType === JOB_GRAPH) return runGraph(client, now);
  const quoted = await quotedRates(context.rates, context.logger);
  return performIngest(performInput(client, job, context, quoted));
}

async function runGraph(client: PoolClient, now: Date) {
  await runGraphRefresh(client, process.env);
  return {
    status: IngestionStatus.Success,
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: null,
    finishedAt: now,
  };
}

/** Spends one request of the source's daily cap; uncapped sources always pass. */
function requestBudget(source: VacancySource, budget: DailyCounter) {
  const cap = dailyRequestCap(source, process.env);
  if (cap === null) return undefined;
  return () => budget.take(`source-requests:${source}`, cap);
}

async function quotedRates(
  load: () => Promise<Record<string, number>>,
  logger: Logger,
): Promise<{ rates: Record<string, number>; rateError: string | null }> {
  try {
    return { rates: await load(), rateError: null };
  } catch (error) {
    logger.error({ err: error }, 'NBRB rates are unavailable');
    return { rates: {}, rateError: error instanceof Error ? error.message : 'NBRB rates failed' };
  }
}

function performInput(
  client: PoolClient,
  job: IngestJob,
  context: JobContext,
  quoted: { rates: Record<string, number>; rateError: string | null },
) {
  return {
    job,
    client,
    http: liveHttp(),
    rates: quoted.rates,
    rateError: quoted.rateError,
    limit: context.limit,
    now: new Date(),
    requestBudget: requestBudget(job.source, context.budget),
  };
}

function liveHttp(): HttpGet {
  return {
    get: async (url, headers) => {
      const response = await fetch(url, { headers });
      return { status: response.status, body: await response.text() };
    },
  };
}

async function failRun(
  runs: ReturnType<typeof createPgRunStore>,
  runId: string,
  error: unknown,
): Promise<void> {
  await runs.finish(runId, {
    status: IngestionStatus.Failed,
    fetched: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 1,
    errors: [{ message: error instanceof Error ? error.message : 'run failed' }],
    finishedAt: new Date(),
  });
}

async function closeAll(
  worker: Worker<IngestJob>,
  queue: Queue<IngestJob>,
  queueConnection: Redis,
  workerConnection: Redis,
  closeSkills: () => Promise<void>,
): Promise<void> {
  await closeSkills();
  await closeRuntime(worker, queue, queueConnection, workerConnection);
}

async function closeRuntime(
  worker: Worker<IngestJob>,
  queue: Queue<IngestJob>,
  queueConnection: Redis,
  workerConnection: Redis,
): Promise<void> {
  await worker.close();
  await queue.close();
  await queueConnection.quit();
  await workerConnection.quit();
}
