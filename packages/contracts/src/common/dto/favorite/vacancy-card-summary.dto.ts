import type { VacancySource } from '../../enums/vacancy-source.enum';
import type { VacancyStatus } from '../../enums/vacancy-status.enum';
import type { WorkFormat } from '../../enums/work-format.enum';

/** Collapsed vacancy on a favorites list. Match explanation stays on the chat card. */
export interface VacancyCardSummary {
  id: string;
  /** Null only for the removed-vacancy placeholder. */
  source: VacancySource | null;
  title: string;
  companyName: string;
  locationLabel: string | null;
  status: VacancyStatus;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  workFormat: WorkFormat | null;
  isForeignRemote: boolean;
}
