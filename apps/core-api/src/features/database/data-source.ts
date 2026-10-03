import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { InitialSchema1760000000000 } from './migrations/1760000000000-initial-schema';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** Options shared by the migrator and the Nest process. Synchronize stays off. */
export function createDatabaseOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    entities: ENTITIES,
    migrations: [InitialSchema1760000000000],
    namingStrategy: new SnakeNamingStrategy(),
  };
}

/** Builds a data source. The caller initializes it. */
export function createDataSource(databaseUrl: string): DataSource {
  return new DataSource(createDatabaseOptions(databaseUrl));
}
