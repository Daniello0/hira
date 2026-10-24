import { VacancySource } from '@hira/contracts';
import type { ConnectorCadence } from '../../common/enums/connector-cadence.enum';
import { readBooleanEnv, readCountEnv } from '../../common/utils/env-flags';
import { gszConnector } from './gsz/gsz.connector';
import { habrConnector } from './habr/habr.connector';
import { indeedConnector } from './indeed/indeed.connector';
import { linkedinConnector } from './linkedin/linkedin.connector';
import { pracaConnector } from './praca/praca.connector';
import { rabotaConnector } from './rabota/rabota.connector';
import type { VacancyConnector } from './vacancy-connector';

const CONNECTORS: Record<VacancySource, VacancyConnector> = {
  [VacancySource.RabotaBy]: rabotaConnector,
  [VacancySource.Gsz]: gszConnector,
  [VacancySource.HabrCareer]: habrConnector,
  [VacancySource.PracaBy]: pracaConnector,
  [VacancySource.LinkedIn]: linkedinConnector,
  [VacancySource.Indeed]: indeedConnector,
};

/** The connector of a source. */
export function connectorFor(source: VacancySource): VacancyConnector {
  const connector = CONNECTORS[source] as VacancyConnector | undefined;
  if (connector === undefined) throw new Error(`source ${source} has no connector`);
  return connector;
}

/** Whether `SOURCE_<SOURCE>_ENABLED` (or the connector default) lets the source run. */
export function isSourceEnabled(source: VacancySource, env: NodeJS.ProcessEnv): boolean {
  const connector = connectorFor(source);
  return readBooleanEnv(env, connector.enabledEnv, connector.enabledByDefault);
}

/** Daily request cap of a source, or null when it has none. */
export function dailyRequestCap(source: VacancySource, env: NodeJS.ProcessEnv): number | null {
  const cap = connectorFor(source).dailyCap;
  return cap === null ? null : readCountEnv(env, cap.env, cap.fallback);
}

/** Sources with this cadence, in registry order. */
export function sourcesWithCadence(cadence: ConnectorCadence): VacancySource[] {
  return Object.values(CONNECTORS)
    .filter((connector) => connector.cadence === cadence)
    .map((connector) => connector.source);
}

/** Error text for a run asked on a disabled source. */
export function disabledMessage(source: VacancySource): string {
  return `source ${source} is disabled; set ${connectorFor(source).enabledEnv}=true to collect it`;
}
