import { VacancySource } from '@hira/contracts';
import {
  INGEST_QUEUE,
  JOB_INCREMENTAL,
  JOB_LIVENESS,
  QUEUE_PREFIX,
  STAGE_SOURCES,
} from '../ingestion.constants';

export interface IngestJob {
  source: VacancySource;
  jobType: string;
  runId?: string;
}

export interface IngestQueue {
  add(job: IngestJob): Promise<void>;
}

export interface CronRegistrar {
  schedule(expression: string, task: () => void): void;
}

export interface IngestionSchedule {
  expression: string;
  jobType: string;
  sources: readonly VacancySource[];
}

/** Incremental collection and the daily liveness pass for sources 1–3. */
export function ingestionSchedules(): IngestionSchedule[] {
  return [
    { expression: '0 */6 * * *', jobType: JOB_INCREMENTAL, sources: STAGE_SOURCES },
    { expression: '0 3 * * *', jobType: JOB_LIVENESS, sources: STAGE_SOURCES },
  ];
}

/** BullMQ queue name, kept off the LLM cache and the login counters. */
export function bullQueueName(): string {
  return `${QUEUE_PREFIX}:${INGEST_QUEUE}`;
}

/** Registers cron callbacks that only enqueue work. */
export function registerIngestionCron(cron: CronRegistrar, queue: IngestQueue): void {
  for (const item of ingestionSchedules()) {
    cron.schedule(item.expression, () => enqueueSources(queue, item));
  }
}

function enqueueSources(queue: IngestQueue, item: IngestionSchedule): void {
  for (const source of item.sources) {
    void queue.add({ source, jobType: item.jobType });
  }
}
