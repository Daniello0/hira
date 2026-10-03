import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { Logger } from 'pino';
import { LOGGER } from './common/constants/app.constants';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { createLogger, readLogLevel } from './common/logger';
import { DatabaseModule } from './features/database/database.module';
import { HealthModule } from './features/health/health.module';

/** Root module: health plus the cross-cutting request id and error shape. */
@Module({
  imports: [DatabaseModule, HealthModule],
  providers: [
    {
      provide: LOGGER,
      useFactory: (): Logger => createLogger(readLogLevel(process.env)),
    },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
