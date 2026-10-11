import { DataSource } from 'typeorm';
import { createDataSource } from './data-source';

/** Applies pending migrations and closes the connection. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  await withDataSource(databaseUrl, (source) => source.runMigrations());
}

/** Reverts the last applied migration and closes the connection. */
export async function revertLastMigration(databaseUrl: string): Promise<void> {
  await withDataSource(databaseUrl, (source) => source.undoLastMigration());
}

/** Reverts every applied migration. Down scripts must be able to drop the schema. */
export async function revertAllMigrations(databaseUrl: string): Promise<void> {
  const source = createDataSource(databaseUrl);
  await source.initialize();
  try {
    while ((await executedMigrationCount(source)) > 0) {
      await source.undoLastMigration();
    }
  } finally {
    await source.destroy();
  }
}

async function executedMigrationCount(source: DataSource): Promise<number> {
  const rows: Array<{ count: number }> = await source.query(
    'SELECT COUNT(*)::int AS count FROM migrations',
  );
  return rows[0]?.count ?? 0;
}

async function withDataSource(
  databaseUrl: string,
  action: (source: ReturnType<typeof createDataSource>) => Promise<unknown>,
): Promise<void> {
  const source = createDataSource(databaseUrl);
  await source.initialize();
  try {
    await action(source);
  } finally {
    await source.destroy();
  }
}
