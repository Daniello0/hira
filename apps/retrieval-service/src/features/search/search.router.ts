import { createApiErrorResponse, RetrievalBranch, type RetrievalResponse } from '@hira/contracts';
import { Router, type Request, type Response } from 'express';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import { readSearchRequest } from './read-search-request';
import { runBranches, type BranchRun, type BranchSearch } from './run-branches';
import {
  RETRIEVAL_UNAVAILABLE_CODE,
  RETRIEVAL_UNAVAILABLE_MESSAGE,
  VALIDATION_FAILED_CODE,
  VALIDATION_FAILED_MESSAGE,
} from './search.constants';

/** `POST /internal/v1/search`. Ranked cards wait for fusion; this stage returns branch diagnostics. */
export function createSearchRouter(search: BranchSearch): Router {
  const router = Router();
  router.post('/search', (req, res) => {
    answer(search, req, res).catch(() => sendUnavailable(req, res));
  });
  return router;
}

async function answer(search: BranchSearch, req: Request, res: Response): Promise<void> {
  const parsed = readSearchRequest(req.body);
  if (parsed === null) {
    res.status(400).json(invalid(req));
    return;
  }
  const started = Date.now();
  const run = await runBranches(parsed.intent, parsed.options, search);
  res.status(200).json(responseOf(run, Date.now() - started));
}

function responseOf(run: BranchRun, totalLatencyMs: number): RetrievalResponse {
  return {
    results: [],
    diagnostics: {
      branchTimings: run.timings,
      candidateCounts: countsOf(run),
      fusedCount: 0,
      relaxationSteps: [],
      rerankApplied: false,
      totalLatencyMs,
    },
  };
}

function countsOf(run: BranchRun): Record<RetrievalBranch, number> {
  return {
    [RetrievalBranch.Lexical]: run.lexical.length,
    [RetrievalBranch.Dense]: run.dense.length,
    [RetrievalBranch.Graph]: 0,
  };
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
