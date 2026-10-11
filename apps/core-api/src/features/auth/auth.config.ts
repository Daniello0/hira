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

/** Browser origin allowed to send credentials. An empty value uses the local web app. */
export function readWebOrigin(env: NodeJS.ProcessEnv): string {
  const origin = env[ENV.webOrigin];
  if (origin === undefined || origin.trim().length === 0) return DEFAULT_WEB_ORIGIN;
  return origin.trim();
}
