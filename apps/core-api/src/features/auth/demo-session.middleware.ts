import { randomUUID } from 'node:crypto';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  DEMO_SESSION_COOKIE_NAME,
  DEMO_SESSION_TTL_SECONDS,
  isDemoSessionId,
} from './auth.constants';
import { readRefreshCookie, sessionCookieOptions } from './auth-http';

/** Issues `demoSessionId` for anonymous browsers. Search quotas key off this cookie. */
@Injectable()
export class DemoSessionMiddleware implements NestMiddleware {
  /** Sets the cookie when the caller is not already in an account session. */
  use(request: Request, response: Response, next: NextFunction): void {
    if (shouldIssueDemo(request)) ensureDemoCookie(request, response);
    next();
  }
}

function shouldIssueDemo(request: Request): boolean {
  if (isHealthPath(request)) return false;
  if (request.header('authorization') !== undefined) return false;
  return readRefreshCookie(request) === undefined;
}

interface DemoRequest extends Request {
  demoSessionId?: string;
}

/** Demo cookie already on the request, or the id this response is about to set. */
export function readIssuedDemoSession(request: Request): string | undefined {
  const stamped = (request as DemoRequest).demoSessionId;
  if (isDemoSessionId(stamped)) return stamped;
  const cookie = readDemoCookie(request);
  return isDemoSessionId(cookie) ? cookie : undefined;
}

function ensureDemoCookie(request: Request, response: Response): void {
  const current = readIssuedDemoSession(request);
  if (isDemoSessionId(current)) {
    stampDemoSession(request, current);
    return;
  }
  const sessionId = randomUUID();
  response.cookie(DEMO_SESSION_COOKIE_NAME, sessionId, sessionCookieOptions(DEMO_SESSION_TTL_SECONDS));
  stampDemoSession(request, sessionId);
}

function stampDemoSession(request: Request, sessionId: string): void {
  (request as DemoRequest).demoSessionId = sessionId;
}

function isHealthPath(request: Request): boolean {
  return [request.path, request.originalUrl, request.url].some((value) => {
    const path = (value ?? '').split('?')[0];
    return path === '/health' || path.startsWith('/health/');
  });
}

function readDemoCookie(request: Request): unknown {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  return cookies?.[DEMO_SESSION_COOKIE_NAME];
}
