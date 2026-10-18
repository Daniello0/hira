import { createApiErrorResponse } from '@hira/contracts';
import { Router, type Request, type Response } from 'express';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import { readSearchRequest } from './read-search-request';
import { runSearch, type SearchPorts } from './run-search';
import {
  RETRIEVAL_UNAVAILABLE_CODE,
  RETRIEVAL_UNAVAILABLE_MESSAGE,
  VALIDATION_FAILED_CODE,
  VALIDATION_FAILED_MESSAGE,
} from './search.constants';

/** `POST /internal/v1/search`. Branch failure is 503; a dead reranker is not. */
export function createSearchRouter(search: SearchPorts): Router {
  const router = Router();
  router.post('/search', (req, res) => {
    answer(search, req, res).catch(() => sendUnavailable(req, res));
  });
  return router;
}

async function answer(search: SearchPorts, req: Request, res: Response): Promise<void> {
  const parsed = readSearchRequest(req.body);
  if (parsed === null) {
    res.status(400).json(invalid(req));
    return;
  }
  res.status(200).json(await runSearch(parsed, search));
}

function invalid(req: Request) {
  return createApiErrorResponse(VALIDATION_FAILED_CODE, VALIDATION_FAILED_MESSAGE, readRequestId(req));
}

function sendUnavailable(req: Request, res: Response): void {
  if (res.headersSent) return;
  res
    .status(503)
    .json(createApiErrorResponse(RETRIEVAL_UNAVAILABLE_CODE, RETRIEVAL_UNAVAILABLE_MESSAGE, readRequestId(req)));
}
