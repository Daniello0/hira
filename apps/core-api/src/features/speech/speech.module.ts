import { Module } from '@nestjs/common';
import type { Logger } from 'pino';
import { ENV, LOGGER } from '../../common/constants/app.constants';
import { createLogger, readLogLevel } from '../../common/logger';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { DEFAULT_LLM_URL } from '../search-orchestrator/search.constants';
import { createCloudListener, createCloudSpeaker, createSpeechGateway } from './speech-gateway';
import { SpeechController } from './speech.controller';
import { DEFAULT_SPEECH_URL, SPEECH_GATEWAY } from './speech.constants';

/** Speech: the cloud hears and speaks, the container does either when the cloud fails. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [SpeechController],
  providers: [
    { provide: LOGGER, useFactory: (): Logger => createLogger(readLogLevel(process.env)) },
    {
      provide: SPEECH_GATEWAY,
      inject: [LOGGER],
      useFactory: (logger: Logger) => {
        const llm = { baseUrl: process.env[ENV.llmServiceUrl]?.trim() || DEFAULT_LLM_URL, token: process.env[ENV.internalToken]?.trim() ?? '' };
        return createSpeechGateway(
          (process.env[ENV.speechUrl]?.trim() || DEFAULT_SPEECH_URL).replace(/\/$/, ''),
          fetch,
          { speak: createCloudSpeaker(llm), onFailure: (error) => logger.warn({ err: error }, 'cloud voice failed, the local voice speaks') },
          { hear: createCloudListener(llm), onFailure: (error) => logger.warn({ err: error }, 'cloud ear failed, the local model hears') },
        );
      },
    },
  ],
})
export class SpeechModule {}
