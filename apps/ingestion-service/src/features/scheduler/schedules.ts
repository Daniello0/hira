import type { VacancySource } from '@hira/contracts';
import { ConnectorCadence } from '../../common/enums/connector-cadence.enum';
import { isSourceEnabled, sourcesWithCadence } from '../connectors/registry';
import {
  INGEST_QUEUE,
  JOB_INCREMENTAL,
  JOB_LIVENESS,
  JOB_RECONCILE,
  LIVENESS_CRON,
  NIGHTLY_COLLECT_CRON,
  QUEUE_PREFIX,
  RECONCILE_CRON,
  SIX_HOURLY_CRON,
  STAGE_SOURCES,
} from '../ingestion.constants';
import { cronJobId, type EnqueueOptions } from './cron-job-id';

export interface IngestJob {
  source: VacancySource;
  jobType: string;
  runId?: string;
}

export interface IngestQueue {
  add(job: IngestJob, options?: EnqueueOptions): Promise<void>;
}

export interface CronRegistrar {
  schedule(expression: string, task: () => void): void;
}

export interface IngestionSchedule {
  expression: string;
  jobType: string;
  sources: readonly VacancySource[];
}

/**
 * Wiki/03 §3: Belarusian sources every six hours, LinkedIn and Indeed nightly, liveness at
 * 03:00 for all, and a weekly reconciliation of the six-hourly sources.
 */
export function ingestionSchedules(): IngestionSchedule[] {
  const sixHourly = sourcesWithCadence(ConnectorCadence.SixHourly);
  return [
    { expression: SIX_HOURLY_CRON, jobType: JOB_INCREMENTAL, sources: sixHourly },
    {
      expression: NIGHTLY_COLLECT_CRON,
      jobType: JOB_INCREMENTAL,
      sources: sourcesWithCadence(ConnectorCadence.Nightly),
    },
    { expression: LIVENESS_CRON, jobType: JOB_LIVENESS, sources: STAGE_SOURCES },
    { expression: RECONCILE_CRON, jobType: JOB_RECONCILE, sources: sixHourly },
  ];
}

/** BullMQ queue name, kept off the LLM cache and the login counters. */
export function bullQueueName(): string {
  return `${QUEUE_PREFIX}:${INGEST_QUEUE}`;
}

/** Registers cron callbacks that only enqueue work. Disabled sources are skipped at fire time. */
export function registerIngestionCron(
  cron: CronRegistrar,
  queue: IngestQueue,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const item of ingestionSchedules()) {
    cron.schedule(item.expression, () => enqueueSources(queue, item, env));
  }
}

function enqueueSources(queue: IngestQueue, item: IngestionSchedule, env: NodeJS.ProcessEnv): void {
  for (const source of item.sources.filter((one) => isSourceEnabled(one, env))) {
    void queue.add({ source, jobType: item.jobType }, { jobId: cronJobId(item.jobType, source) });
  }
}
