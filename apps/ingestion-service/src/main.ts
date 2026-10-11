import { Pool } from 'pg';
import { createApp } from './app';
import { DEFAULT_PORT, ENV, SERVICE_NAME } from './common/constants/app.constants';
import { createLogger, readLogLevel } from './common/logger';
import { readInternalToken, readPort } from './common/utils/env';
import { listen } from './common/utils/listen';
import { buildIngestionProbes } from './features/health/build-probes';
import { attachIngestionRuntime } from './features/scheduler/attach-runtime';
import { readIngestLimit } from './features/scheduler/read-ingest-limit';

async function main(): Promise<void> {
  const logger = createLogger(readLogLevel(process.env));
  const runtime = openRuntime(logger);
  const app = createApp({
    logger,
    internalToken: readInternalToken(process.env),
    probes: buildIngestionProbes(process.env),
    internalRouter: runtime?.router,
  });
  const port = readPort(process.env, DEFAULT_PORT);
  await listen(app, port);
  logger.info({ port }, `${SERVICE_NAME} listening`);
}

function openRuntime(logger: ReturnType<typeof createLogger>) {
  const databaseUrl = process.env[ENV.databaseUrl];
  const redisUrl = process.env[ENV.redisUrl];
  if (databaseUrl === undefined || redisUrl === undefined) return undefined;
  if (databaseUrl.trim().length === 0 || redisUrl.trim().length === 0) return undefined;
  const pool = new Pool({ connectionString: databaseUrl });
  return attachIngestionRuntime(pool, redisUrl, readIngestLimit(process.env), logger);
}

main().catch((error: unknown) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
