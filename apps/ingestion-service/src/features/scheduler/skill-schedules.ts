import { VacancySource } from '@hira/contracts';
import {
  EMBED_QUEUE,
  EXTRACT_SKILLS_QUEUE,
  GRAPH_QUEUE,
  JOB_EMBED,
  JOB_EXTRACT_SKILLS,
  JOB_GRAPH,
  STAGE_SOURCES,
} from '../ingestion.constants';
import type { CronRegistrar } from './schedules';

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
  add(queue: string, job: SkillIndexJob): Promise<void>;
}

/** Skill extraction, vacancy embeddings, and the nightly graph refresh. */
export function skillIndexSchedules(): SkillIndexSchedule[] {
  return [
    schedule('*/15 * * * *', EXTRACT_SKILLS_QUEUE, JOB_EXTRACT_SKILLS, STAGE_SOURCES),
    schedule('*/15 * * * *', EMBED_QUEUE, JOB_EMBED, STAGE_SOURCES),
    schedule('0 4 * * *', GRAPH_QUEUE, JOB_GRAPH, []),
  ];
}

/** Registers cron callbacks that only enqueue skill and embed work. */
export function registerSkillIndexCron(cron: CronRegistrar, queue: SkillIndexQueue): void {
  for (const item of skillIndexSchedules()) {
    cron.schedule(item.expression, () => enqueue(queue, item));
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

function enqueue(queue: SkillIndexQueue, item: SkillIndexSchedule): void {
  if (item.sources.length === 0) {
    void queue.add(item.queue, { jobType: item.jobType });
    return;
  }
  for (const source of item.sources) void queue.add(item.queue, { source, jobType: item.jobType });
}
