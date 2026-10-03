import { createDataSource } from './data-source';

/** Applies pending migrations and closes the connection. */
export async function runMigrations(databaseUrl: string): Promise<void> {
  await withDataSource(databaseUrl, (source) => source.runMigrations());
}

/** Reverts the last applied migration and closes the connection. */
export async function revertLastMigration(databaseUrl: string): Promise<void> {
  await withDataSource(databaseUrl, (source) => source.undoLastMigration());
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
