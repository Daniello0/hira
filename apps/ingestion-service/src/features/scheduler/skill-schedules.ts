import { VacancySource } from '@hira/contracts';
import { isSourceEnabled } from '../connectors/registry';
import {
  EMBED_QUEUE,
  EXTRACT_SKILLS_QUEUE,
  GRAPH_QUEUE,
  JOB_EMBED,
  JOB_EXTRACT_SKILLS,
  JOB_GRAPH,
  STAGE_SOURCES,
} from '../ingestion.constants';
import { cronJobId, type EnqueueOptions } from './cron-job-id';
import type { CronRegistrar } from './schedules';
import { isSkillExtractionEnabled } from './skill-flags';

export interface SkillIndexSchedule {
  expression: string;
  queue: string;
  jobType: string;
  sources: readonly VacancySource[];
}

export interface SkillIndexJob {
  jobType: string;
  source?: VacancySource;
}

export interface SkillIndexQueue {
  add(queue: string, job: SkillIndexJob, options?: EnqueueOptions): Promise<void>;
}

/** Skill extraction, vacancy embeddings, and the nightly graph refresh. */
export function skillIndexSchedules(): SkillIndexSchedule[] {
  return [
    schedule('*/15 * * * *', EXTRACT_SKILLS_QUEUE, JOB_EXTRACT_SKILLS, STAGE_SOURCES),
    schedule('*/15 * * * *', EMBED_QUEUE, JOB_EMBED, STAGE_SOURCES),
    schedule('0 4 * * *', GRAPH_QUEUE, JOB_GRAPH, []),
  ];
}

/**
 * Registers cron callbacks that only enqueue skill and embed work. Disabled sources and,
 * with `SKILL_EXTRACTION_ENABLED=false`, the extraction ticks are skipped at fire time.
 */
export function registerSkillIndexCron(
  cron: CronRegistrar,
  queue: SkillIndexQueue,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const item of skillIndexSchedules()) {
    cron.schedule(item.expression, () => enqueue(queue, item, env));
  }
}

function schedule(
  expression: string,
  queue: string,
  jobType: string,
  sources: readonly VacancySource[],
): SkillIndexSchedule {
  return { expression, queue, jobType, sources };
}

function enqueue(queue: SkillIndexQueue, item: SkillIndexSchedule, env: NodeJS.ProcessEnv): void {
  if (item.jobType === JOB_EXTRACT_SKILLS && !isSkillExtractionEnabled(env)) return;
  if (item.sources.length === 0) {
    void queue.add(item.queue, { jobType: item.jobType }, { jobId: cronJobId(item.jobType) });
    return;
  }
  for (const source of item.sources.filter((one) => isSourceEnabled(one, env))) {
    void queue.add(
      item.queue,
      { source, jobType: item.jobType },
      { jobId: cronJobId(item.jobType, source) },
    );
  }
}
