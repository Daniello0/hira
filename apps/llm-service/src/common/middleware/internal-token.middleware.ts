import { createApiErrorResponse } from '@hira/contracts';
import type { NextFunction, Request, Response } from 'express';
import {
  INTERNAL_TOKEN_HEADER,
  INTERNAL_TOKEN_INVALID_CODE,
  INTERNAL_TOKEN_INVALID_MESSAGE,
} from '../constants/app.constants';
import { readRequestId } from './request-id.middleware';

const OPEN_PATHS = new Set(['/health', '/health/ready']);

/** Requires `X-Internal-Token` on every route except liveness and readiness. */
export function internalTokenMiddleware(expectedToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (OPEN_PATHS.has(req.path)) {
      next();
      return;
    }
    if (tokenMatches(expectedToken, req.header(INTERNAL_TOKEN_HEADER))) {
      next();
      return;
    }
    res.status(401).json(unauthorizedBody(req));
  };
}

function tokenMatches(expectedToken: string, provided: string | undefined): boolean {
  return expectedToken.length > 0 && provided === expectedToken;
}

function unauthorizedBody(req: Request) {
  return createApiErrorResponse(
    INTERNAL_TOKEN_INVALID_CODE,
    INTERNAL_TOKEN_INVALID_MESSAGE,
    readRequestId(req),
  );
}
