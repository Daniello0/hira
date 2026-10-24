import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';

/** `GET /locations`. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [LocationController],
  providers: [LocationService],
})
export class LocationModule {}
