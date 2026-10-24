import type { VacancySource } from '@hira/contracts';
import { CRON_JOB_ID_PREFIX } from '../ingestion.constants';

/** Options a cron tick passes with its job. */
export interface EnqueueOptions {
  /** Fixed BullMQ id: while one tick of this job waits or runs, the next is dropped. */
  jobId?: string;
}

/** `cron-EXTRACT_SKILLS-RABOTA_BY`. BullMQ refuses ':' in custom ids. */
export function cronJobId(jobType: string, source?: VacancySource): string {
  return [CRON_JOB_ID_PREFIX, jobType, source].filter((part) => part !== undefined).join('-');
}
