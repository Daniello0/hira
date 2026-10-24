import { VacancySource } from '@hira/contracts';
import { isArchivedVacancy } from '../archived-page';
import { ALL_QUERY, STAGE7_PAUSE, pagedPath, sixHourly } from '../connector-defaults';
import type { VacancyConnector } from '../vacancy-connector';
import { gszVacancyPath, parseGszList, parseGszVacancy } from './parse-gsz';

/** GSZ public vacancy search (gsz.gov.by). */
export const gszConnector: VacancyConnector = {
  ...sixHourly(VacancySource.Gsz, STAGE7_PAUSE),
  origin: 'https://gsz.gov.by',
  queries: [ALL_QUERY],
  listPath: (_query, page) => pagedPath('/registration/vacancy-search/', '?', page),
  parseList: (html) => parseGszList(html).map((item) => ({ externalId: item.externalId })),
  detailPath: gszVacancyPath,
  parseDetail: (html, ref) => parseGszVacancy(html, ref.externalId),
  isArchived: isArchivedVacancy,
};
