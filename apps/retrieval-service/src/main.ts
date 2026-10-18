import { Pool } from 'pg';
import { createApp } from './app';
import { DEFAULT_PORT, ENV, SERVICE_NAME } from './common/constants/app.constants';
import { createLogger, readLogLevel } from './common/logger';
import { readInternalToken, readPort } from './common/utils/env';
import { listen } from './common/utils/listen';
import { buildRetrievalProbes } from './features/health/build-probes';
import { openSearch } from './features/search/open-search';
import type { SearchPorts } from './features/search/run-search';

async function main(): Promise<void> {
  const logger = createLogger(readLogLevel(process.env));
  const app = createApp({
    logger,
    internalToken: readInternalToken(process.env),
    probes: buildRetrievalProbes(process.env),
    search: bindSearch(process.env),
  });
  const port = readPort(process.env, DEFAULT_PORT);
  await listen(app, port);
  logger.info({ port }, `${SERVICE_NAME} listening`);
}

function bindSearch(env: NodeJS.ProcessEnv): SearchPorts | undefined {
  const databaseUrl = env[ENV.databaseUrl]?.trim() ?? '';
  if (databaseUrl.length === 0) return undefined;
  return openSearch(new Pool({ connectionString: databaseUrl }), env);
}

main().catch((error: unknown) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
