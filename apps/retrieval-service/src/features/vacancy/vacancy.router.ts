import {
  createApiErrorResponse,
  type SimilarVacanciesDto,
  type SkillGapDto,
  type VacancyDto,
} from '@hira/contracts';
import { Router, type Request, type Response } from 'express';
import { NOT_FOUND_ERROR_CODE } from '../../common/constants/app.constants';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import { VALIDATION_FAILED_CODE } from '../search/search.constants';
import { readSimilarRequest, readSkillGapRequest } from './read-vacancy-request';
import { VACANCY_NOT_FOUND_MESSAGE, VACANCY_REQUEST_INVALID_MESSAGE } from './vacancy.constants';

/** Reads behind the vacancy card. Null means the vacancy does not exist. */
export interface VacancyPorts {
  findSimilar(vacancyId: string, limit: number): Promise<VacancyDto[] | null>;
  skillGap(vacancyId: string, userId: string): Promise<SkillGapDto | null>;
}

/**
 * `POST /internal/v1/similar` and `POST /internal/v1/skill-gap`.
 * 400 VALIDATION_FAILED for a bad body, 404 NOT_FOUND for an unknown vacancy;
 * anything else reaches the error middleware (logged, 500 INTERNAL_ERROR).
 */
export function createVacancyRouter(ports: VacancyPorts): Router {
  const router = Router();
  router.post('/similar', (req, res, next) => {
    answerSimilar(ports, req, res).catch(next);
  });
  router.post('/skill-gap', (req, res, next) => {
    answerSkillGap(ports, req, res).catch(next);
  });
  return router;
}

async function answerSimilar(ports: VacancyPorts, req: Request, res: Response): Promise<void> {
  const parsed = readSimilarRequest(req.body);
  if (parsed === null) return sendError(req, res, 400);
  const items = await ports.findSimilar(parsed.vacancyId, parsed.limit);
  if (items === null) return sendError(req, res, 404);
  const body: SimilarVacanciesDto = { items };
  res.status(200).json(body);
}

async function answerSkillGap(ports: VacancyPorts, req: Request, res: Response): Promise<void> {
  const parsed = readSkillGapRequest(req.body);
  if (parsed === null) return sendError(req, res, 400);
  const gap = await ports.skillGap(parsed.vacancyId, parsed.userId);
  if (gap === null) return sendError(req, res, 404);
  res.status(200).json(gap);
}

function sendError(req: Request, res: Response, status: 400 | 404): void {
  const body =
    status === 400
      ? createApiErrorResponse(
          VALIDATION_FAILED_CODE,
          VACANCY_REQUEST_INVALID_MESSAGE,
          readRequestId(req),
        )
      : createApiErrorResponse(NOT_FOUND_ERROR_CODE, VACANCY_NOT_FOUND_MESSAGE, readRequestId(req));
  res.status(status).json(body);
}
