import { Pool } from 'pg';
import { createApp } from './app';
import { DEFAULT_PORT, ENV, SERVICE_NAME } from './common/constants/app.constants';
import { createLogger, readLogLevel } from './common/logger';
import { readInternalToken, readPort } from './common/utils/env';
import { listen } from './common/utils/listen';
import { buildRetrievalProbes } from './features/health/build-probes';
import { openSearch } from './features/search/open-search';
import type { SearchPorts } from './features/search/run-search';
import { openVacancy } from './features/vacancy/open-vacancy';
import type { VacancyPorts } from './features/vacancy/vacancy.router';

async function main(): Promise<void> {
  const logger = createLogger(readLogLevel(process.env));
  const app = createApp({
    logger,
    internalToken: readInternalToken(process.env),
    probes: buildRetrievalProbes(process.env),
    ...bindDatabase(process.env),
  });
  const port = readPort(process.env, DEFAULT_PORT);
  await listen(app, port);
  logger.info({ port }, `${SERVICE_NAME} listening`);
}

/** Search and vacancy reads share one pool. Without DATABASE_URL neither route is mounted. */
function bindDatabase(env: NodeJS.ProcessEnv): { search?: SearchPorts; vacancy?: VacancyPorts } {
  const databaseUrl = env[ENV.databaseUrl]?.trim() ?? '';
  if (databaseUrl.length === 0) return {};
  const pool = new Pool({ connectionString: databaseUrl });
  return { search: openSearch(pool, env), vacancy: openVacancy(pool) };
}

main().catch((error: unknown) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
