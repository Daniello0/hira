import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Logger } from 'pino';
import { ENV, LOGGER } from '../../common/constants/app.constants';
import { createLogger, readLogLevel } from '../../common/logger';
import { AuthModule } from '../auth/auth.module';
import { DemoSessionMiddleware } from '../auth/demo-session.middleware';
import { ChatModule } from '../chat/chat.module';
import { SearchController } from './search.controller';
import {
  DEFAULT_LLM_URL,
  DEFAULT_RETRIEVAL_URL,
  LLM_GATEWAY,
  LLM_TIMEOUT_MS,
  RETRIEVAL_GATEWAY,
  RETRIEVAL_TIMEOUT_MS,
} from './search.constants';
import { SearchOrchestratorService } from './search-orchestrator.service';
import { createLlmGateway, createRetrievalGateway } from './upstream-gateway';

/** Search turn: llm-service, retrieval-service, and the chat store. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [SearchController],
  providers: [
    SearchOrchestratorService,
    { provide: LOGGER, useFactory: (): Logger => createLogger(readLogLevel(process.env)) },
    { provide: LLM_GATEWAY, useFactory: () => createLlmGateway(llmOptions(process.env)) },
    { provide: RETRIEVAL_GATEWAY, useFactory: () => createRetrievalGateway(retrievalOptions(process.env)) },
  ],
})
export class SearchOrchestratorModule implements NestModule {
  /** Same demo cookie as chats. The stamp keeps a second middleware from issuing another id. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser(), DemoSessionMiddleware).forRoutes('*');
  }
}

function llmOptions(env: NodeJS.ProcessEnv) {
  return {
    baseUrl: readUrl(env, ENV.llmServiceUrl, DEFAULT_LLM_URL),
    token: env[ENV.internalToken]?.trim() ?? '',
    timeoutMs: LLM_TIMEOUT_MS,
  };
}

function retrievalOptions(env: NodeJS.ProcessEnv) {
  return {
    baseUrl: readUrl(env, ENV.retrievalServiceUrl, DEFAULT_RETRIEVAL_URL),
    token: env[ENV.internalToken]?.trim() ?? '',
    timeoutMs: RETRIEVAL_TIMEOUT_MS,
  };
}

function readUrl(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const value = env[key]?.trim();
  if (value === undefined || value.length === 0) return fallback;
  return value.replace(/\/$/, '');
}
