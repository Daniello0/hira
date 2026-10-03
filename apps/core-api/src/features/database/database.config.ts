import { ENV } from '../../common/constants/app.constants';

const UNUSED_DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';

/**
 * Reads `DATABASE_URL` for the migrator and the process boot path.
 * A blank value is rejected so a container cannot migrate the wrong database.
 */
export function readDatabaseUrl(env: NodeJS.ProcessEnv): string {
  const url = readOptionalDatabaseUrl(env);
  if (url === undefined) {
    throw new Error('DATABASE_URL is required');
  }
  return url;
}

/**
 * URL for the Nest module. Tests that boot the HTTP app without a database
 * receive a placeholder that is never opened (`manualInitialization`).
 */
export function databaseUrlOrUnused(env: NodeJS.ProcessEnv): string {
  return readOptionalDatabaseUrl(env) ?? UNUSED_DATABASE_URL;
}

function readOptionalDatabaseUrl(env: NodeJS.ProcessEnv): string | undefined {
  const url = env[ENV.databaseUrl];
  if (url === undefined || url.trim().length === 0) {
    return undefined;
  }
  return url;
}
