import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { InitialSchema1760000000000 } from './migrations/1760000000000-initial-schema';
import { DemoChat1763000000000 } from './migrations/1763000000000-demo-chat';
import { Stage12Memory1764000000000 } from './migrations/1764000000000-stage-12-memory';
import { DefaultCollectionIndex1765000000000 } from './migrations/1765000000000-default-collection-index';
import { Stage15FeedbackAndSkillFailures1766000000000 } from './migrations/1766000000000-stage-15-feedback-and-skill-failures';
import { RefreshTokenHashIndex1762000000000 } from './migrations/1762000000000-refresh-token-hash-index';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** Options shared by the migrator and the Nest process. Synchronize stays off. */
export function createDatabaseOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    entities: ENTITIES,
    migrations: [
      InitialSchema1760000000000,
      RefreshTokenHashIndex1762000000000,
      DemoChat1763000000000,
      Stage12Memory1764000000000,
      DefaultCollectionIndex1765000000000,
      Stage15FeedbackAndSkillFailures1766000000000,
    ],
    namingStrategy: new SnakeNamingStrategy(),
  };
}

/** Builds a data source. The caller initializes it. */
export function createDataSource(databaseUrl: string): DataSource {
  return new DataSource(createDatabaseOptions(databaseUrl));
}
