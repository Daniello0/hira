import type { VacancySource } from '@hira/contracts';
import type { ConnectorCadence } from '../../common/enums/connector-cadence.enum';
import type { RawVacancy, RawVacancyRef } from './raw-vacancy';

/** Random pause between two requests to the same source. */
export interface PauseRange {
  minMs: number;
  maxMs: number;
}

/**
 * One vacancy source (Wiki/03-data-sources.md §2.1). Adding a source adds one of these
 * to the registry; the collector, liveness check, and scheduler stay untouched.
 */
export interface VacancyConnector {
  readonly source: VacancySource;
  readonly origin: string;
  /** Independent list queries, read one after another (LinkedIn: Belarus, then remote). */
  readonly queries: readonly string[];
  /** Path of list page `page` (0-based) for a query; null when the source has no such page. */
  listPath(query: string, page: number): string | null;
  parseList(html: string, query: string): RawVacancyRef[];
  detailPath(externalId: string): string;
  parseDetail(html: string, ref: RawVacancyRef): RawVacancy;
  /** True when the page itself says the posting is closed. */
  isArchived(html: string): boolean;
  readonly pause: PauseRange;
  readonly cadence: ConnectorCadence;
  /** Environment switch name, e.g. `SOURCE_LINKEDIN_ENABLED`. */
  readonly enabledEnv: string;
  readonly enabledByDefault: boolean;
  /** Daily request cap env name and default; null for uncapped sources. */
  readonly dailyCap: { env: string; fallback: number } | null;
}
