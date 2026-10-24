import { VacancySource } from '@hira/contracts';
import { ConnectorCadence } from '../../../common/enums/connector-cadence.enum';
import { FOREIGN_PAUSE, dailyCapEnvOf, enabledEnvOf } from '../connector-defaults';
import type { VacancyConnector } from '../vacancy-connector';
import {
  INDEED_ORIGIN,
  INDEED_QUERY_REMOTE,
  indeedDetailPath,
  indeedListPath,
  isIndeedExpired,
  parseIndeedList,
  parseIndeedVacancy,
} from './parse-indeed';

const INDEED_DAILY_CAP = 100;

/**
 * Public Indeed HTML, remote jobs only. Off by default: Cloudflare answers 403 to non-browsers,
 * and robots.txt disallows `/viewjob` for `User-agent: *`, so the robots check stops the run.
 */
export const indeedConnector: VacancyConnector = {
  source: VacancySource.Indeed,
  origin: INDEED_ORIGIN,
  queries: [INDEED_QUERY_REMOTE],
  listPath: indeedListPath,
  parseList: parseIndeedList,
  detailPath: indeedDetailPath,
  parseDetail: parseIndeedVacancy,
  isArchived: isIndeedExpired,
  pause: FOREIGN_PAUSE,
  cadence: ConnectorCadence.Nightly,
  enabledEnv: enabledEnvOf(VacancySource.Indeed),
  enabledByDefault: false,
  dailyCap: { env: dailyCapEnvOf(VacancySource.Indeed), fallback: INDEED_DAILY_CAP },
};
