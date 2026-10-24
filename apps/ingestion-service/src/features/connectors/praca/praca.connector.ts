import { VacancySource } from '@hira/contracts';
import { BELARUS_PAUSE, pagedPath, sixHourly } from '../connector-defaults';
import type { VacancyConnector } from '../vacancy-connector';
import {
  PRACA_ORIGIN,
  isPracaArchived,
  parsePracaList,
  parsePracaVacancy,
  pracaVacancyPath,
} from './parse-praca';

/**
 * City list pages. robots.txt forbids `/search/vacancies` and any `?…search…` query,
 * so the crawl walks `/rabota-<city>/?page=N`. Minsk holds most postings.
 */
const CITY_PAGES = ['/rabota-minsk/'] as const;

/** praca.by public HTML (Wiki/03 source 4). */
export const pracaConnector: VacancyConnector = {
  ...sixHourly(VacancySource.PracaBy, BELARUS_PAUSE),
  origin: PRACA_ORIGIN,
  queries: CITY_PAGES,
  listPath: (query, page) => pagedPath(query, '?', page),
  parseList: (html) => parsePracaList(html),
  detailPath: pracaVacancyPath,
  parseDetail: parsePracaVacancy,
  isArchived: isPracaArchived,
};
