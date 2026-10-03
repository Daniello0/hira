import { createApiErrorResponse } from '@hira/contracts';
import { Router, type Request, type Response } from 'express';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import { NOT_READY_ERROR_CODE, NOT_READY_MESSAGE } from './health.constants';
import { collectReadiness, liveness, toReadinessResponse } from './health.service';
import type { DependencyProbe, ReadinessReport } from './health.types';

/** Mounts `GET /` and `GET /ready` under `/health`. */
export function healthRouter(probes: readonly DependencyProbe[]): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.status(200).json(liveness());
  });
  router.get('/ready', (req, res, next) => {
    sendReadiness(probes, req, res).catch(next);
  });
  return router;
}

async function sendReadiness(
  probes: readonly DependencyProbe[],
  req: Request,
  res: Response,
): Promise<void> {
  const report = await collectReadiness(probes);
  if (!report.ready) {
    res.status(503).json(notReadyBody(req, report));
    return;
  }
  res.status(200).json(toReadinessResponse(report));
}

function notReadyBody(req: Request, report: ReadinessReport) {
  return createApiErrorResponse(NOT_READY_ERROR_CODE, NOT_READY_MESSAGE, readRequestId(req), {
    checks: report.checks,
  });
}
