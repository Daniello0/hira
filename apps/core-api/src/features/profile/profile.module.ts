import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { PROFILE_STORE } from './profile.store';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { TypeOrmProfileStore } from './typeorm-profile.store';

/** Seeker profile and suggestions. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [ProfileController],
  providers: [ProfileService, TypeOrmProfileStore, { provide: PROFILE_STORE, useExisting: TypeOrmProfileStore }],
  exports: [ProfileService, PROFILE_STORE],
})
export class ProfileModule {}
