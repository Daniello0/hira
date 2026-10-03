import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants/app.constants';

export interface RequestWithId extends Request {
  requestId: string;
}

/** Copies `X-Request-Id` or assigns a new one, then echoes it on the response. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(REQUEST_ID_HEADER);
  const requestId = incoming !== undefined && incoming.trim().length > 0 ? incoming : randomUUID();
  (req as RequestWithId).requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

/** Reads the id assigned by `requestIdMiddleware`. */
export function readRequestId(req: Request): string {
  const requestId = (req as RequestWithId).requestId;
  if (requestId === undefined || requestId.length === 0) {
    return 'unknown';
  }
  return requestId;
}
