export const DEFAULT_PORT = 4003;
export const DEFAULT_LOG_LEVEL = 'info';
export const JSON_BODY_LIMIT = '1mb';
export const REQUEST_ID_HEADER = 'X-Request-Id';
export const INTERNAL_TOKEN_HEADER = 'X-Internal-Token';
export const INTERNAL_TOKEN_INVALID_CODE = 'INTERNAL_TOKEN_INVALID';
export const INTERNAL_TOKEN_INVALID_MESSAGE = 'Internal token is missing or invalid';
export const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';
export const NOT_FOUND_MESSAGE = 'Route not found';
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
export const INTERNAL_ERROR_MESSAGE = 'Unexpected error';
export const SERVICE_NAME = 'ingestion-service';

export const ENV = {
  port: 'PORT',
  logLevel: 'LOG_LEVEL',
  internalToken: 'INTERNAL_API_TOKEN',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
} as const;
