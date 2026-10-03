import { ENV } from '../constants/app.constants';

const MIN_PORT = 1;
const MAX_PORT = 65535;

/** Reads `PORT`. An empty value uses the service default. */
export function readPort(env: NodeJS.ProcessEnv, fallback: number): number {
  const raw = env[ENV.port];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(`PORT must be an integer from ${MIN_PORT} to ${MAX_PORT}, received "${raw}"`);
  }
  return port;
}
