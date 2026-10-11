import { createApiErrorResponse, type ApiErrorResponse } from '@hira/contracts';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import type { GenerateRequest, UnderstandRequest, UnderstandResponse } from '@hira/contracts';
import type { LlmStreamEvent } from '../generate/generate.service';
import {
  LLM_NOT_CONFIGURED_CODE,
  LLM_NOT_CONFIGURED_MESSAGE,
  LLM_NOT_CONFIGURED_STATUS,
  LLM_PROVIDER_HEADER,
  LLM_PROVIDER_ID,
  SSE_ERROR_EVENT,
} from './llm.constants';
import { LlmRouteError, StreamInterruptedError } from './llm.errors';
import { parseGenerateRequest, parseUnderstandRequest } from './llm-request.schema';
import { toRouteError } from './route-error';

export interface LlmRouterDeps {
  apiKey: string;
  model: string;
  understand: (request: UnderstandRequest) => Promise<UnderstandResponse>;
  generate: (request: GenerateRequest, emit: (event: LlmStreamEvent) => void) => Promise<void>;
}

/** Internal understand and generate routes. Health stays on the parent app. */
export function createLlmRouter(deps: LlmRouterDeps): Router {
  const router = Router();
  router.post('/understand', asyncHandler((req, res) => postUnderstand(deps, req, res)));
  router.post('/generate', asyncHandler((req, res) => postGenerate(deps, req, res)));
  return router;
}

async function postUnderstand(deps: LlmRouterDeps, req: Request, res: Response): Promise<void> {
  try {
    assertConfigured(deps);
    const body = parseUnderstandRequest(req.body);
    res.setHeader(LLM_PROVIDER_HEADER, LLM_PROVIDER_ID);
    res.status(200).json(await deps.understand(body));
  } catch (error) {
    sendFailure(res, req, error);
  }
}

async function postGenerate(deps: LlmRouterDeps, req: Request, res: Response): Promise<void> {
  try {
    assertConfigured(deps);
    const body = parseGenerateRequest(req.body);
    res.setHeader(LLM_PROVIDER_HEADER, LLM_PROVIDER_ID);
    await writeGenerate(deps, req, res, body);
  } catch (error) {
    sendFailure(res, req, error);
  }
}

async function writeGenerate(
  deps: LlmRouterDeps,
  req: Request,
  res: Response,
  body: GenerateRequest,
): Promise<void> {
  let started = false;
  try {
    await deps.generate(body, (event) => {
      started = openStream(res, started);
      writeSse(res, event.name, event.data);
    });
    if (started) res.end();
  } catch (error) {
    finishGenerateError(res, req, error, started);
  }
}

function finishGenerateError(res: Response, req: Request, error: unknown, started: boolean): void {
  const cause = error instanceof StreamInterruptedError ? error.cause : error;
  if (!started) {
    sendFailure(res, req, cause);
    return;
  }
  writeSse(res, SSE_ERROR_EVENT, errorData(req, cause));
  res.end();
}

function openStream(res: Response, started: boolean): boolean {
  if (started) return true;
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return true;
}

function writeSse(res: Response, name: string, data: unknown): void {
  res.write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

function assertConfigured(deps: LlmRouterDeps): void {
  if (deps.apiKey.trim().length > 0 && deps.model.trim().length > 0) return;
  throw new LlmRouteError(
    LLM_NOT_CONFIGURED_STATUS,
    LLM_NOT_CONFIGURED_CODE,
    LLM_NOT_CONFIGURED_MESSAGE,
  );
}

function sendFailure(res: Response, req: Request, error: unknown): void {
  const route = toRouteError(error);
  if (route === null) throw error;
  res.status(route.status).json(errorData(req, route));
}

function errorData(req: Request, error: unknown): ApiErrorResponse {
  const route = error instanceof LlmRouteError ? error : toRouteError(error);
  if (route === null) throw error;
  return createApiErrorResponse(route.errorCode, route.message, readRequestId(req), route.details);
}

function asyncHandler(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res).catch(next);
  };
}
