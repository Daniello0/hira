import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { CALL_STORE } from './call.store';
import { TypeOrmCallStore } from './typeorm-call.store';

/** Call sessions. The streaming turn is registered beside search. */
@Module({
  imports: [AuthModule, ChatModule],
  providers: [TypeOrmCallStore, { provide: CALL_STORE, useExisting: TypeOrmCallStore }],
  exports: [CALL_STORE],
})
export class CallModule {}
