import { VacancySource, VacancyStatus } from '@hira/contracts';

/** A vacancy row the pipeline can compare and write. */
export interface StoredVacancy {
  id: string;
  source: VacancySource;
  externalId: string;
  title: string;
  companyName: string;
  city: string | null;
  description: string;
  simhash: string;
  contentHash: string;
  status: VacancyStatus;
  lastSeenAt: Date;
  embedding: string | null;
  skillsExtractedAt: Date | null;
}

/** Persistence used by the in-memory pipeline tests and the Postgres store adapter. */
export interface VacancyWriter {
  findByNaturalKey(source: VacancySource, externalId: string): Promise<StoredVacancy | null>;
  insert(row: StoredVacancy): Promise<void>;
  touch(id: string, seenAt: Date): Promise<void>;
  replaceContent(row: StoredVacancy): Promise<void>;
  findActiveExcept(id: string): Promise<StoredVacancy[]>;
  markDuplicate(id: string): Promise<void>;
  expireOlderThan(cutoff: Date): Promise<number>;
}
