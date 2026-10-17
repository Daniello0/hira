import { createApiErrorResponse, ReindexScope } from '@hira/contracts';
import { Router, type Request, type Response } from 'express';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import { NOT_FOUND_ERROR_CODE, NOT_FOUND_MESSAGE } from '../../common/constants/app.constants';
import {
  JOB_TYPES,
  STAGE_SOURCES,
  VALIDATION_FAILED_CODE,
  VALIDATION_FAILED_MESSAGE,
} from '../ingestion.constants';
import { isRecord } from '../connectors/record';
import type { IngestJob, IngestQueue } from '../scheduler/schedules';
import type { RunWriter } from '../store/run-writer';

export interface ReindexCommand {
  scope: ReindexScope;
  vacancyIds?: string[];
}

export interface RunsDeps {
  runs: RunWriter;
  queue: IngestQueue;
  now: () => Date;
  reindex?: (command: ReindexCommand) => Promise<number>;
}

/** `POST/GET /internal/v1/runs`. Reindex stays on stage 8. */
export function createRunsRouter(deps: RunsDeps): Router {
  const router = Router();
  router.post('/runs', (req, res, next) => {
    startRun(deps, req, res).catch(next);
  });
  router.get('/runs', (_req, res, next) => {
    deps.runs
      .list()
      .then((rows) => res.status(200).json(rows))
      .catch(next);
  });
  router.get('/runs/:id', (req, res, next) => {
    sendOne(deps, req, res).catch(next);
  });
  router.post('/reindex', (req, res, next) => {
    reindex(deps, req, res).catch(next);
  });
  return router;
}

async function startRun(deps: RunsDeps, req: Request, res: Response): Promise<void> {
  const command = readRunCommand(req.body);
  if (command === null) {
    res.status(400).json(invalid(req));
    return;
  }
  const run = await deps.runs.start(command.source, command.jobType, deps.now());
  await deps.queue.add({ source: command.source, jobType: command.jobType, runId: run.id });
  res.status(202).json(run);
}

async function reindex(deps: RunsDeps, req: Request, res: Response): Promise<void> {
  const command = readReindex(req.body);
  if (command === null || deps.reindex === undefined) {
    res.status(400).json(invalid(req));
    return;
  }
  const updated = await deps.reindex(command);
  res.status(202).json({ updated });
}

function readReindex(body: unknown): ReindexCommand | null {
  if (!isRecord(body) || typeof body.scope !== 'string') return null;
  if (!isScope(body.scope)) return null;
  const vacancyIds = readIds(body.vacancyIds);
  if (vacancyIds === null) return null;
  return vacancyIds === undefined ? { scope: body.scope } : { scope: body.scope, vacancyIds };
}

function isScope(value: string): value is ReindexScope {
  return (Object.values(ReindexScope) as string[]).includes(value);
}

function readIds(value: unknown): string[] | undefined | null {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !UUID.test(item))) {
    return null;
  }
  return value;
}

async function sendOne(deps: RunsDeps, req: Request, res: Response): Promise<void> {
  const run = await deps.runs.get(req.params.id);
  if (run === null) {
    res
      .status(404)
      .json(createApiErrorResponse(NOT_FOUND_ERROR_CODE, NOT_FOUND_MESSAGE, readRequestId(req)));
    return;
  }
  res.status(200).json(run);
}

function readRunCommand(body: unknown): IngestJob | null {
  if (!isRecord(body) || typeof body.jobType !== 'string' || typeof body.source !== 'string')
    return null;
  if (!isStageSource(body.source) || !isJobType(body.jobType)) return null;
  return { source: body.source, jobType: body.jobType };
}

function isStageSource(value: string): value is (typeof STAGE_SOURCES)[number] {
  return (STAGE_SOURCES as readonly string[]).includes(value);
}

function isJobType(value: string): boolean {
  return (JOB_TYPES as readonly string[]).includes(value);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(req: Request) {
  return createApiErrorResponse(
    VALIDATION_FAILED_CODE,
    VALIDATION_FAILED_MESSAGE,
    readRequestId(req),
  );
}
