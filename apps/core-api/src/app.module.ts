import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import type { Logger } from 'pino';
import { LOGGER } from './common/constants/app.constants';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { createLogger, readLogLevel } from './common/logger';
import { DatabaseModule } from './features/database/database.module';
import { HealthModule } from './features/health/health.module';
import { AuthModule } from './features/auth/auth.module';
import { ChatModule } from './features/chat/chat.module';
import { CallModule } from './features/call/call.module';
import { LibraryModule } from './features/library/library.module';
import { MemoryModule } from './features/memory/memory.module';
import { FavoriteModule } from './features/favorite/favorite.module';
import { ProfileModule } from './features/profile/profile.module';
import { SkillModule } from './features/skill/skill.module';
import { RedisModule } from './features/redis/redis.module';
import { SearchOrchestratorModule } from './features/search-orchestrator/search-orchestrator.module';
import { VacancyModule } from './features/vacancy/vacancy.module';
import { FeedbackModule } from './features/feedback/feedback.module';
import { LocationModule } from './features/location/location.module';
import { AdminModule } from './features/admin/admin.module';
import { BillingModule } from './features/billing/billing.module';

/** Root module: health, auth, and the cross-cutting request id and error shape. */
@Module({
  imports: [DatabaseModule, RedisModule, HealthModule, AuthModule, BillingModule, ChatModule, CallModule, MemoryModule, LibraryModule, ProfileModule, FavoriteModule, SkillModule, SearchOrchestratorModule, VacancyModule, FeedbackModule, LocationModule, AdminModule],
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
