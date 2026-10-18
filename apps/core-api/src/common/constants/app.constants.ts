export const DEFAULT_PORT = 4000;
export const DEFAULT_LOG_LEVEL = 'info';
export const REQUEST_ID_HEADER = 'X-Request-Id';
export const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
export const INTERNAL_ERROR_MESSAGE = 'Unexpected error';
export const VALIDATION_ERROR_CODE = 'VALIDATION_FAILED';
export const VALIDATION_ERROR_MESSAGE = 'Request validation failed';
export const RATE_LIMIT_ERROR_CODE = 'RATE_LIMIT_EXCEEDED';
export const AUTH_UNAUTHORIZED = 'AUTH_UNAUTHORIZED';
export const SERVICE_NAME = 'core-api';

export const ENV = {
  port: 'PORT',
  logLevel: 'LOG_LEVEL',
  databaseUrl: 'DATABASE_URL',
  redisUrl: 'REDIS_URL',
  jwtSecret: 'JWT_SECRET',
  webOrigin: 'WEB_ORIGIN',
  internalToken: 'INTERNAL_API_TOKEN',
  retrievalServiceUrl: 'RETRIEVAL_SERVICE_URL',
  llmServiceUrl: 'LLM_SERVICE_URL',
  teiEmbedUrl: 'TEI_EMBED_URL',
  libraryRoot: 'LIBRARY_ROOT',
} as const;

export const LOGGER = Symbol('LOGGER');
