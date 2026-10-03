import { createApp } from './app';
import { DEFAULT_PORT, SERVICE_NAME } from './common/constants/app.constants';
import { createLogger, readLogLevel } from './common/logger';
import { readInternalToken, readPort } from './common/utils/env';
import { listen } from './common/utils/listen';
import { buildIngestionProbes } from './features/health/build-probes';

async function main(): Promise<void> {
  const logger = createLogger(readLogLevel(process.env));
  const app = createApp({
    logger,
    internalToken: readInternalToken(process.env),
    probes: buildIngestionProbes(process.env),
  });
  const port = readPort(process.env, DEFAULT_PORT);
  await listen(app, port);
  logger.info({ port }, `${SERVICE_NAME} listening`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
