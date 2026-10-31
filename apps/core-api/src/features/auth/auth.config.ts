import { ENV } from '../../common/constants/app.constants';
import { JWT_SECRET_MIN_LENGTH } from './auth.constants';

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/**
 * Fail-fast check for process boot.
 * Tests that never sign a token do not have to call this.
 */
export function readJwtSecret(env: NodeJS.ProcessEnv): string {
  const secret = env[ENV.jwtSecret];
  if (secret === undefined || secret.length < JWT_SECRET_MIN_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${JWT_SECRET_MIN_LENGTH} characters`);
  }
  return secret;
}

/**
 * Browser origins allowed to send credentials, comma-separated: for example this machine and its
 * address on the local network, for a phone. An empty value uses the local web app.
 */
export function readWebOrigins(env: NodeJS.ProcessEnv): string[] {
  const origins = (env[ENV.webOrigin] ?? '').split(',').map((origin) => origin.trim()).filter((origin) => origin.length > 0);
  return origins.length === 0 ? [DEFAULT_WEB_ORIGIN] : origins;
}
