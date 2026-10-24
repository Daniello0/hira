import { VacancySource } from '@hira/contracts';
import { ConnectorCadence } from '../../../common/enums/connector-cadence.enum';
import { FOREIGN_PAUSE, dailyCapEnvOf, enabledEnvOf } from '../connector-defaults';
import type { VacancyConnector } from '../vacancy-connector';
import {
  LINKEDIN_ORIGIN,
  LINKEDIN_QUERY_BELARUS,
  LINKEDIN_QUERY_REMOTE,
  isLinkedinClosed,
  linkedinDetailPath,
  linkedinListPath,
  parseLinkedinList,
  parseLinkedinVacancy,
} from './parse-linkedin';

const LINKEDIN_DAILY_CAP = 150;

/**
 * Public guest job pages, no login (Wiki/03 §1.3). Off by default: LinkedIn's robots.txt
 * disallows every path for `User-agent: *`, so the robots check refuses the run anyway.
 */
export const linkedinConnector: VacancyConnector = {
  source: VacancySource.LinkedIn,
  origin: LINKEDIN_ORIGIN,
  queries: [LINKEDIN_QUERY_BELARUS, LINKEDIN_QUERY_REMOTE],
  listPath: linkedinListPath,
  parseList: parseLinkedinList,
  detailPath: linkedinDetailPath,
  parseDetail: parseLinkedinVacancy,
  isArchived: isLinkedinClosed,
  pause: FOREIGN_PAUSE,
  cadence: ConnectorCadence.Nightly,
  enabledEnv: enabledEnvOf(VacancySource.LinkedIn),
  enabledByDefault: false,
  dailyCap: { env: dailyCapEnvOf(VacancySource.LinkedIn), fallback: LINKEDIN_DAILY_CAP },
};
