import type { Request } from 'express';
import { readIssuedDemoSession } from '../auth/demo-session.middleware';
import { readOptionalAuth } from '../auth/optional-access.guard';
import type { CallerHint } from './resolve-actor';

/** Bearer user, demo cookie, or neither. */
export function actorHint(request: Request): CallerHint {
  const auth = readOptionalAuth(request);
  if (auth !== null) return { kind: 'user', userId: auth.userId };
  const sessionId = readIssuedDemoSession(request);
  if (sessionId === undefined) return { kind: 'anonymous' };
  return { kind: 'demo', sessionId };
}
