import type { EmploymentType } from '../../enums/employment-type.enum';
import type { Language } from '../../enums/language.enum';
import type { RateUnit } from '../../enums/rate-unit.enum';
import type { SeniorityLevel } from '../../enums/seniority-level.enum';
import type { VacancySource } from '../../enums/vacancy-source.enum';
import type { VacancyStatus } from '../../enums/vacancy-status.enum';
import type { WorkFormat } from '../../enums/work-format.enum';

/**
 * Public vacancy card. Internal columns (embedding, search vector, raw HTML, content hash)
 * stay in the database and are not part of this contract.
 */
export interface VacancyDto {
  id: string;
  source: VacancySource;
  language: Language;
  externalId: string;
  url: string;
  title: string;
  companyId: string | null;
  locationId: number | null;
  description: string;
  seniority: SeniorityLevel | null;
  employment: EmploymentType | null;
  workFormat: WorkFormat | null;
  schedule: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryMinByn: number | null;
  salaryMaxByn: number | null;
  isGross: boolean | null;
  rateAmount: number | null;
  rateUnit: RateUnit | null;
  projectDurationDays: number | null;
  isForeignRemote: boolean;
  status: VacancyStatus;
  publishedAt: string;
}
