import { Module } from '@nestjs/common';
import type { Logger } from 'pino';
import { ENV, LOGGER } from '../../common/constants/app.constants';
import { createLogger, readLogLevel } from '../../common/logger';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { DEFAULT_LLM_URL } from '../search-orchestrator/search.constants';
import { createCloudSpeaker, createSpeechGateway } from './speech-gateway';
import { SpeechController } from './speech.controller';
import { DEFAULT_SPEECH_URL, SPEECH_GATEWAY } from './speech.constants';

/** Speech: the container hears, the cloud voice speaks, the container speaks when that fails. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [SpeechController],
  providers: [
    { provide: LOGGER, useFactory: (): Logger => createLogger(readLogLevel(process.env)) },
    {
      provide: SPEECH_GATEWAY,
      inject: [LOGGER],
      useFactory: (logger: Logger) =>
        createSpeechGateway((process.env[ENV.speechUrl]?.trim() || DEFAULT_SPEECH_URL).replace(/\/$/, ''), fetch, {
          speak: createCloudSpeaker({
            baseUrl: process.env[ENV.llmServiceUrl]?.trim() || DEFAULT_LLM_URL,
            token: process.env[ENV.internalToken]?.trim() ?? '',
          }),
          onFailure: (error) => logger.warn({ err: error }, 'cloud voice failed, the local voice speaks'),
        }),
    },
  ],
})
export class SpeechModule {}
