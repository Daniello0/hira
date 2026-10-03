export const DEFAULT_PORT = 4000;
export const DEFAULT_LOG_LEVEL = 'info';
export const REQUEST_ID_HEADER = 'X-Request-Id';
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
export const INTERNAL_ERROR_MESSAGE = 'Unexpected error';
export const SERVICE_NAME = 'core-api';

export const ENV = {
  port: 'PORT',
  logLevel: 'LOG_LEVEL',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
} as const;

export const LOGGER = Symbol('LOGGER');
