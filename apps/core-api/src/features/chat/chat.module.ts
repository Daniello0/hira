import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DemoSessionMiddleware } from '../auth/demo-session.middleware';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { CHAT_STORE } from './chat.store';
import { TypeOrmChatStore } from './typeorm-chat.store';
import cookieParser from 'cookie-parser';

/** Chats and the dialogue store. The streaming turn is registered by the orchestrator. */
@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  providers: [ChatService, TypeOrmChatStore, { provide: CHAT_STORE, useExisting: TypeOrmChatStore }],
  exports: [ChatService, CHAT_STORE],
})
export class ChatModule implements NestModule {
  /** Demo cookie for anonymous chat calls. A second pass sees the id already stamped. */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(cookieParser(), DemoSessionMiddleware).forRoutes('*');
  }
}
