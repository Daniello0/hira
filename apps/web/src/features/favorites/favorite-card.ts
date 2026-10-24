import { VacancyStatus, type VacancyCardSummary } from '@hira/contracts';
import { SALARY_NOT_LISTED } from '../vacancy/vacancy.constants';

/** True when the original posting is no longer open. */
export function favoriteClosed(vacancy: VacancyCardSummary): boolean {
  return vacancy.status !== VacancyStatus.Active;
}

/** Salary line for a saved card. A missing range stays explicit. */
export function favoritePay(vacancy: VacancyCardSummary): string {
  if (vacancy.salaryMin === null && vacancy.salaryMax === null) return SALARY_NOT_LISTED;
  const span = vacancy.salaryMin !== null && vacancy.salaryMax !== null ? `${vacancy.salaryMin}–${vacancy.salaryMax}` : String(vacancy.salaryMin ?? vacancy.salaryMax);
  return `${span} ${vacancy.salaryCurrency ?? ''}`.trim();
}
