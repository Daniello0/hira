import type { VacancySource } from '@hira/contracts';
import { ConnectorCadence } from '../../common/enums/connector-cadence.enum';
import { SOURCE_PAUSE_MS } from '../ingestion.constants';
import type { PauseRange } from './vacancy-connector';

/** The single list query of a source that has one. */
export const ALL_QUERY = 'all';

/** Fixed two-second pause the stage-7 sources have always used. */
export const STAGE7_PAUSE: PauseRange = { minMs: SOURCE_PAUSE_MS, maxMs: SOURCE_PAUSE_MS };
/** Wiki/03 §4: 1 request every 2–5 s for Belarusian sources. */
export const BELARUS_PAUSE: PauseRange = { minMs: 2_000, maxMs: 5_000 };
/** Wiki/03 §1.3: 1 request every 10–15 s for LinkedIn and Indeed. */
export const FOREIGN_PAUSE: PauseRange = { minMs: 10_000, maxMs: 15_000 };

/** `SOURCE_<SOURCE>_ENABLED`, e.g. `SOURCE_LINKEDIN_ENABLED`. */
export function enabledEnvOf(source: VacancySource): string {
  return `SOURCE_${source}_ENABLED`;
}

/** `SOURCE_<SOURCE>_DAILY_CAP`, e.g. `SOURCE_LINKEDIN_DAILY_CAP`. */
export function dailyCapEnvOf(source: VacancySource): string {
  return `SOURCE_${source}_DAILY_CAP`;
}

/** Shared settings of a six-hourly Belarusian source that is on by default. */
export function sixHourly(source: VacancySource, pause: PauseRange) {
  return {
    source,
    pause,
    cadence: ConnectorCadence.SixHourly,
    enabledEnv: enabledEnvOf(source),
    enabledByDefault: true,
    dailyCap: null,
  } as const;
}

/** Path of page `page` built as `<first>` then `<first><join>page=<page + 1>`. */
export function pagedPath(first: string, join: '?' | '&', page: number): string {
  return page === 0 ? first : `${first}${join}page=${page + 1}`;
}
