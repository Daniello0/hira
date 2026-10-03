import pino, { type Logger } from 'pino';
import { DEFAULT_LOG_LEVEL, ENV } from './constants/app.constants';

/** Structured JSON logger. The level comes from `LOG_LEVEL`. */
export function createLogger(level: string): Logger {
  return pino({ level });
}

/** Reads `LOG_LEVEL`, falling back to the service default. */
export function readLogLevel(env: NodeJS.ProcessEnv): string {
  const level = env[ENV.logLevel];
  if (level === undefined || level.trim().length === 0) {
    return DEFAULT_LOG_LEVEL;
  }
  return level;
}
