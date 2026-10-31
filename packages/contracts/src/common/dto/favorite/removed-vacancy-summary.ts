import { VacancyStatus } from '../../enums/vacancy-status.enum';
import type { VacancyCardSummary } from './vacancy-card-summary.dto';

/** Title shown when the corpus row is gone but the favorite row remains. */
export const REMOVED_VACANCY_TITLE = 'Vacancy removed';

/** Placeholder card for a favorite whose vacancy was deleted from the corpus. */
export function removedVacancySummary(vacancyId: string): VacancyCardSummary {
  return {
    id: vacancyId,
    source: null,
    title: REMOVED_VACANCY_TITLE,
    companyName: '',
    locationLabel: null,
    status: VacancyStatus.Expired,
    url: '',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    workFormat: null,
  isForeignRemote: false,
  };
}

/** True when the summary is the removed-vacancy placeholder. */
export function isRemovedVacancySummary(vacancy: VacancyCardSummary): boolean {
  return vacancy.title === REMOVED_VACANCY_TITLE;
}
