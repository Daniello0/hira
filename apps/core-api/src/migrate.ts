import 'reflect-metadata';
import { readDatabaseUrl } from './features/database/database.config';
import { runMigrations } from './features/database/run-migrations';

runMigrations(readDatabaseUrl(process.env)).catch((error: unknown) => {
  process.stderr.write(`migration failed: ${String(error)}\n`);
  process.exitCode = 1;
});
