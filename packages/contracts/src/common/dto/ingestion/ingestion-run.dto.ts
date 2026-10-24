import type { IngestionStatus } from '../../enums/ingestion-status.enum';
import type { VacancySource } from '../../enums/vacancy-source.enum';

/** One row of `GET /api/v1/admin/ingestion/runs`, read from `ingestion_runs`. */
export interface IngestionRunDto {
  id: string;
  source: VacancySource;
  jobType: string;
  status: IngestionStatus;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Record<string, unknown> | null;
}
