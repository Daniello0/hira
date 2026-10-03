import { createApiErrorResponse } from '@hira/contracts';
import type { NextFunction, Request, Response } from 'express';
import type { Logger } from 'pino';
import { INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE } from '../constants/app.constants';
import { readRequestId } from './request-id.middleware';

/** Logs an unexpected failure and answers with the shared error body. */
export function errorMiddleware(logger: Logger) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    logger.error({ err: error, requestId: readRequestId(req) }, 'unhandled error');
    res.status(500).json(unexpectedBody(req));
  };
}

function unexpectedBody(req: Request) {
  return createApiErrorResponse(INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE, readRequestId(req));
}
