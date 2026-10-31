import cookieParser from 'cookie-parser';
import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { RateLimitModule } from '../rate-limit/rate-limit.module';
import { PlanGate } from '../billing/plan-gate';
import { AccessTokenGuard } from './access-token.guard';
import { OptionalAccessGuard } from './optional-access.guard';
import { AccessTokenService } from './access-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoSessionMiddleware } from './demo-session.middleware';
import { PASSWORD_HASHER, Argon2PasswordHasher } from './password.hasher';
import { REFRESH_TOKEN_STORE } from './refresh-token.store';
import { TypeOrmRefreshTokenStore } from './typeorm-refresh-token.store';
import { TypeOrmUserStore } from './typeorm-user.store';
import { USER_STORE } from './user.store';

/** Account sessions. Search quotas are exported for the orchestrator (stage 11). */
@Module({
  imports: [RateLimitModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PlanGate,
    AccessTokenService,
    AccessTokenGuard,
    OptionalAccessGuard,
    DemoSessionMiddleware,
    Argon2PasswordHasher,
    { provide: PASSWORD_HASHER, useExisting: Argon2PasswordHasher },
    TypeOrmUserStore,
    { provide: USER_STORE, useExisting: TypeOrmUserStore },
    TypeOrmRefreshTokenStore,
    { provide: REFRESH_TOKEN_STORE, useExisting: TypeOrmRefreshTokenStore },
  ],
  exports: [RateLimitModule, AuthService, PlanGate, AccessTokenService, OptionalAccessGuard, USER_STORE, DemoSessionMiddleware],
})
export class AuthModule implements NestModule {
  /** Parses cookies before the demo session middleware reads them. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser(), DemoSessionMiddleware).forRoutes('*');
  }
}
