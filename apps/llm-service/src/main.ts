import type { Logger } from 'pino';
import { createApp } from './app';
import { DEFAULT_PORT, ENV, SERVICE_NAME } from './common/constants/app.constants';
import { createLogger, readLogLevel } from './common/logger';
import { readInternalToken, readPort } from './common/utils/env';
import { listen } from './common/utils/listen';
import { buildLlmProbes } from './features/health/build-probes';

async function main(): Promise<void> {
  const logger = createLogger(readLogLevel(process.env));
  logOpenRouterConfig(logger, process.env);
  const app = createApp({
    logger,
    internalToken: readInternalToken(process.env),
    probes: buildLlmProbes(process.env),
  });
  const port = readPort(process.env, DEFAULT_PORT);
  await listen(app, port);
  logger.info({ port }, `${SERVICE_NAME} listening`);
}

/** Records whether a provider key is present without writing the key itself. */
function logOpenRouterConfig(logger: Logger, env: NodeJS.ProcessEnv): void {
  const apiKey = env[ENV.openRouterApiKey]?.trim() ?? '';
  logger.info(
    { openRouterConfigured: apiKey.length > 0, model: env[ENV.openRouterModel] ?? '' },
    'llm provider config',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
