import { IngestionStatus, VacancySource } from '@hira/contracts';

/** One `ingestion_runs` row returned by the internal API. */
export interface RunRecord {
  id: string;
  source: VacancySource;
  jobType: string;
  startedAt: string;
  finishedAt: string | null;
  status: IngestionStatus;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: unknown;
}

/** Creates and reads ingestion runs. */
export interface RunWriter {
  start(source: VacancySource, jobType: string, at: Date): Promise<RunRecord>;
  list(): Promise<RunRecord[]>;
  get(id: string): Promise<RunRecord | null>;
}
