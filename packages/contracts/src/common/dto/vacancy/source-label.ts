import { VacancySource } from '../../enums/vacancy-source.enum';

const SOURCE_SITES: Readonly<Record<VacancySource, string>> = {
  [VacancySource.RabotaBy]: 'rabota.by',
  [VacancySource.Gsz]: 'gsz.gov.by',
  [VacancySource.HabrCareer]: 'career.habr.com',
  [VacancySource.PracaBy]: 'praca.by',
  [VacancySource.LinkedIn]: 'linkedin.com',
  [VacancySource.Indeed]: 'indeed.com',
};

/** The site a vacancy came from. An unknown value is shown as it is. */
export function vacancySourceSite(source: VacancySource | string): string {
  return SOURCE_SITES[source as VacancySource] ?? source;
}
