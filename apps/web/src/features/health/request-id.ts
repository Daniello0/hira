import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from './health.constants';

/** Uses the incoming request id or assigns a new one. */
export function resolveRequestId(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  if (incoming !== null && incoming.trim().length > 0) {
    return incoming;
  }
  return randomUUID();
}
