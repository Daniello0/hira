import { VacancySource } from '@hira/contracts';
import { isArchivedVacancy } from '../archived-page';
import { ALL_QUERY, STAGE7_PAUSE, pagedPath, sixHourly } from '../connector-defaults';
import type { RawVacancy } from '../raw-vacancy';
import type { VacancyConnector } from '../vacancy-connector';
import { parseHabrList, parseHabrVacancy } from './parse-habr';

/** Habr Career vacancies; the list card city fills a detail page without one. */
export const habrConnector: VacancyConnector = {
  ...sixHourly(VacancySource.HabrCareer, STAGE7_PAUSE),
  origin: 'https://career.habr.com',
  queries: [ALL_QUERY],
  listPath: (_query, page) => pagedPath('/vacancies?type=all', '&', page),
  parseList: (html) =>
    parseHabrList(html).map((item) => ({ externalId: item.externalId, city: item.city })),
  detailPath: (externalId) => `/vacancies/${externalId}`,
  parseDetail: (html, ref) => withCardCity(parseHabrVacancy(html, ref.externalId), ref.city),
  isArchived: isArchivedVacancy,
};

function withCardCity(raw: RawVacancy, city: string | null | undefined): RawVacancy {
  if (raw.city !== null) return raw;
  return { ...raw, city: city ?? null };
}
