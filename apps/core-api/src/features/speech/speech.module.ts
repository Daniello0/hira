import { Module } from '@nestjs/common';
import { ENV } from '../../common/constants/app.constants';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { createSpeechGateway } from './speech-gateway';
import { SpeechController } from './speech.controller';
import { DEFAULT_SPEECH_URL, SPEECH_GATEWAY } from './speech.constants';

/** The gateway to the speech container. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [SpeechController],
  providers: [
    {
      provide: SPEECH_GATEWAY,
      useFactory: () => createSpeechGateway((process.env[ENV.speechUrl]?.trim() || DEFAULT_SPEECH_URL).replace(/\/$/, '')),
    },
  ],
})
export class SpeechModule {}
