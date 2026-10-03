import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { createDatabaseOptions } from './data-source';
import { databaseUrlOrUnused } from './database.config';

/** Registers TypeORM without connecting. `main` opens the pool after the URL is checked. */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        ...createDatabaseOptions(databaseUrlOrUnused(process.env)),
        manualInitialization: true,
        retryAttempts: 0,
      }),
    }),
  ],
})
export class DatabaseModule {}
