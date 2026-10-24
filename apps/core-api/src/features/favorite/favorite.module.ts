import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chat/chat.module';
import { CollectionController } from './collection.controller';
import { FavoriteController } from './favorite.controller';
import { FAVORITE_STORE } from './favorite.store';
import { FavoriteService } from './favorite.service';
import { TypeOrmFavoriteStore } from './typeorm-favorite.store';

/** Favorites and collections. Demo sessions are rejected in the controllers. */
@Module({
  imports: [AuthModule, ChatModule],
  controllers: [FavoriteController, CollectionController],
  providers: [FavoriteService, TypeOrmFavoriteStore, { provide: FAVORITE_STORE, useExisting: TypeOrmFavoriteStore }],
  exports: [FavoriteService, FAVORITE_STORE],
})
export class FavoriteModule {}
