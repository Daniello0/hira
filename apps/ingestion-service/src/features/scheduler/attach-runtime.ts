import { Queue, Worker } from 'bullmq';
import type { Router } from 'express';
import { Redis } from 'ioredis';
import cron from 'node-cron';
import type { Logger } from 'pino';
import type { Pool, PoolClient } from 'pg';
import { IngestionStatus } from '@hira/contracts';
import { INGEST_QUEUE, QUEUE_PREFIX } from '../ingestion.constants';
import { createRunsRouter } from '../runs/runs.router';
import type { HttpGet } from '../connectors/collect-source';
import { createDailyRates, fetchNbrbRates } from '../normalize/nbrb-rates';
import { performIngest } from '../store/perform-ingest';
import { createPgRunStore } from '../store/pg-run.store';
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
    (job) => handleJob(pool, job.data, limit, logger, rates),
    {
      connection: workerConnection,
      prefix: QUEUE_PREFIX,
    },
  );
  registerIngestionCron(cron, queueAdapter(queue));
  worker.on('failed', (job, error) =>
    logger.error({ err: error, jobId: job?.id }, 'ingestion job failed'),
  );
  return {
    router: runsRouter(runs, queue),
    close: () => closeRuntime(worker, queue, queueConnection, workerConnection),
  };
}

function runsRouter(runs: ReturnType<typeof createPgRunStore>, queue: Queue<IngestJob>): Router {
  return createRunsRouter({ runs, queue: queueAdapter(queue), now: () => new Date() });
}

function queueAdapter(queue: Queue<IngestJob>): IngestQueue {
  return {
    add: async (job) => {
      await queue.add(job.jobType, job);
    },
  };
}

async function handleJob(
  pool: Pool,
  job: IngestJob,
  limit: number,
  logger: Logger,
  rates: () => Promise<Record<string, number>>,
): Promise<void> {
  const runs = createPgRunStore(pool);
  const runId = job.runId ?? (await runs.start(job.source, job.jobType, new Date())).id;
  const client = await pool.connect();
  try {
    const quoted = await quotedRates(rates, logger);
    await runs.finish(runId, await performIngest(performInput(client, job, limit, quoted)));
  } catch (error) {
    logger.error({ err: error, runId }, 'ingestion run failed');
    await failRun(runs, runId, error);
  } finally {
    client.release();
  }
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
  limit: number,
  quoted: { rates: Record<string, number>; rateError: string | null },
) {
  return {
    job,
    client,
    http: liveHttp(),
    rates: quoted.rates,
    rateError: quoted.rateError,
    limit,
    now: new Date(),
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
