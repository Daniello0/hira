import { DEV_VACANCY_LIMIT } from '../ingestion.constants';

/** Dev snapshot size. A full crawl is an explicit `INGEST_LIMIT`, not the default. */
export function readIngestLimit(env: NodeJS.ProcessEnv): number {
  const raw = env.INGEST_LIMIT;
  if (raw === undefined || raw.trim().length === 0) return DEV_VACANCY_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('INGEST_LIMIT must be a positive integer');
  }
  return value;
}
