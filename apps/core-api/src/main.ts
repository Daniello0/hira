import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Logger } from 'pino';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { DEFAULT_PORT, LOGGER, SERVICE_NAME } from './common/constants/app.constants';
import { readPort } from './common/utils/env';
import { readDatabaseUrl } from './features/database/database.config';

async function bootstrap(): Promise<void> {
  readDatabaseUrl(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  await app.get(DataSource).initialize();
  app.disable('x-powered-by');
  const port = readPort(process.env, DEFAULT_PORT);
  await app.listen(port);
  app.get<Logger>(LOGGER).info({ port }, `${SERVICE_NAME} listening`);
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${SERVICE_NAME} failed to start: ${String(error)}\n`);
  process.exitCode = 1;
});
