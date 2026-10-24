import { VacancySource } from '@hira/contracts';
import { isArchivedVacancy } from '../archived-page';
import { ALL_QUERY, STAGE7_PAUSE, sixHourly } from '../connector-defaults';
import type { VacancyConnector } from '../vacancy-connector';
import { parseRabotaList, parseRabotaVacancy } from './parse-rabota';

const LIST_PATH = '/search/vacancy';

/** rabota.by public HTML (ADR-035). Its robots.txt forbids query strings, so one list page. */
export const rabotaConnector: VacancyConnector = {
  ...sixHourly(VacancySource.RabotaBy, STAGE7_PAUSE),
  origin: 'https://rabota.by',
  queries: [ALL_QUERY],
  listPath: (_query, page) => (page === 0 ? LIST_PATH : `${LIST_PATH}?page=${page}`),
  parseList: (html) => parseRabotaList(html).map((item) => ({ externalId: item.externalId })),
  detailPath: (externalId) => `/vacancy/${externalId}`,
  parseDetail: (html, ref) => parseRabotaVacancy(html, ref.externalId),
  isArchived: isArchivedVacancy,
};
