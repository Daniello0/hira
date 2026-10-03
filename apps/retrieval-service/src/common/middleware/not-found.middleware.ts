import { createApiErrorResponse } from '@hira/contracts';
import type { Request, Response } from 'express';
import { NOT_FOUND_ERROR_CODE, NOT_FOUND_MESSAGE } from '../constants/app.constants';
import { readRequestId } from './request-id.middleware';

/** Returns the shared error body for an unknown route. */
export function notFoundMiddleware(req: Request, res: Response): void {
  res
    .status(404)
    .json(createApiErrorResponse(NOT_FOUND_ERROR_CODE, NOT_FOUND_MESSAGE, readRequestId(req)));
}
