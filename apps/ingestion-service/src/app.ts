import express, { type Express } from 'express';
import type { Logger } from 'pino';
import { JSON_BODY_LIMIT } from './common/constants/app.constants';
import { errorMiddleware } from './common/middleware/error.middleware';
import { internalTokenMiddleware } from './common/middleware/internal-token.middleware';
import { notFoundMiddleware } from './common/middleware/not-found.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { requestLogMiddleware } from './common/middleware/request-log.middleware';
import { healthRouter } from './features/health/health.router';
import type { DependencyProbe } from './features/health/health.types';

export interface AppOptions {
  logger: Logger;
  internalToken: string;
  probes: readonly DependencyProbe[];
}

/** Express application: request id, internal token, health, and the shared error body. */
export function createApp(options: AppOptions): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(requestIdMiddleware);
  app.use(requestLogMiddleware(options.logger));
  app.use(internalTokenMiddleware(options.internalToken));
  app.use('/health', healthRouter(options.probes));
  app.use(notFoundMiddleware);
  app.use(errorMiddleware(options.logger));
  return app;
}
