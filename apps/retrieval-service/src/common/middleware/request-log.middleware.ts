import type { Logger } from 'pino';
import type { NextFunction, Request, Response } from 'express';
import { readRequestId } from './request-id.middleware';

/** Writes one JSON log line when the response finishes. */
export function requestLogMiddleware(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    const path = req.originalUrl;
    res.on('finish', () => {
      logger.info(requestFields(req, res, startedAt, path), 'request');
    });
    next();
  };
}

function requestFields(req: Request, res: Response, startedAt: number, path: string) {
  return {
    requestId: readRequestId(req),
    method: req.method,
    path,
    statusCode: res.statusCode,
    durationMs: Date.now() - startedAt,
  };
}
