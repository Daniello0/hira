import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

/** `POST /feedback`. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [FeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
