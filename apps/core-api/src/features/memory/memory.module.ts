import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { EmbedModule } from '../embed/embed.module';
import { MemoryController } from './memory.controller';
import { MEMORY_STORE } from './memory.store';
import { MemoryService } from './memory.service';
import { TypeOrmMemoryStore } from './typeorm-memory.store';

/** Long-term facts and the account switch. */
@Module({
  imports: [AuthModule, ChatModule, EmbedModule],
  controllers: [MemoryController],
  providers: [MemoryService, TypeOrmMemoryStore, { provide: MEMORY_STORE, useExisting: TypeOrmMemoryStore }],
  exports: [MemoryService, MEMORY_STORE],
})
export class MemoryModule {}
