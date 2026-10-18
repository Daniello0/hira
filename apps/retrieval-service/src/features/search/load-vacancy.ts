import type { SeniorityLevel, VacancyDto } from '@hira/contracts';
import type { SqlClient } from './sql-client';

/** Card fields plus the lexical document the reranker reads. */
export interface LoadedVacancy {
  vacancy: VacancyDto;
  searchDocument: string;
  seniority: SeniorityLevel | null;
}

/** Loads cards in the requested id order. Stub returns nothing. */
export async function loadVacancies(_client: SqlClient, _ids: readonly string[]): Promise<LoadedVacancy[]> {
  return [];
}
