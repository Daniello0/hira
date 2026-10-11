/** Values from Wiki/07-auth-and-memory.md and Wiki/05-api-contracts.md §1.6. */

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const DEMO_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export const REFRESH_COOKIE_NAME = 'refreshToken';
export const DEMO_SESSION_COOKIE_NAME = 'demoSessionId';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

/** argon2id memory cost in kibibytes (64 MiB). */
export const ARGON2_MEMORY_KIB = 64 * 1024;
export const ARGON2_TIME_COST = 3;
export const ARGON2_PARALLELISM = 4;

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_SECONDS = 60;
export const LOGIN_MAX_BACKOFF_SECONDS = 15 * 60;

export const DEMO_SEARCH_LIMIT = 3;
export const REGISTERED_SEARCH_LIMIT = 20;

export const JWT_SECRET_MIN_LENGTH = 32;
export const CLIENT_IP_MAX_LENGTH = 64;
export const CLIENT_USER_AGENT_MAX_LENGTH = 512;

export const AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS';
export const AUTH_EMAIL_TAKEN = 'AUTH_EMAIL_TAKEN';
export const AUTH_REFRESH_INVALID = 'AUTH_REFRESH_INVALID';
export const AUTH_REFRESH_REUSED = 'AUTH_REFRESH_REUSED';

export const LOGIN_ATTEMPT_PREFIX = 'auth:login:attempt:';
export const LOGIN_LOCK_PREFIX = 'auth:login:lock:';
export const LOGIN_PERMIT_PREFIX = 'auth:login:permit:';
export const DEMO_QUOTA_PREFIX = 'quota:search:demo:';
export const USER_QUOTA_PREFIX = 'quota:search:user:';

const DEMO_SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `value` is a UUID v4 issued as the demo cookie. */
export function isDemoSessionId(value: unknown): value is string {
  return typeof value === 'string' && DEMO_SESSION_ID.test(value);
}
