import { createApiErrorResponse, type ApiErrorResponse } from '@hira/contracts';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { readRequestId } from '../../common/middleware/request-id.middleware';
import type {
  ExtractMemoryRequest,
  ExtractMemoryResponse,
  ExtractSkillsRequest,
  ExtractSkillsResponse,
  GenerateRequest,
  ParseResumeRequest,
  ParseResumeResponse,
  SummarizeChatRequest,
  SummarizeChatResponse,
  UnderstandRequest,
  UnderstandResponse,
} from '@hira/contracts';
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
import { parseExtractSkillsRequest } from '../extract-skills/extract-skills.schema';
import { parseGenerateRequest, parseUnderstandRequest } from './llm-request.schema';
import { parseExtractMemoryRequest } from '../extract-memory/extract-memory.schema';
import { parseParseResumeRequest } from '../parse-resume/parse-resume.schema';
import { parseSpeakRequest, type SpeakRequest } from '../speak/speak.service';
import { parseSummarizeRequest } from '../summarize-chat/summarize-chat.schema';
import { toRouteError } from './route-error';

export interface LlmRouterDeps {
  apiKey: string;
  model: string;
  understand: (request: UnderstandRequest) => Promise<UnderstandResponse>;
  generate: (request: GenerateRequest, emit: (event: LlmStreamEvent) => void) => Promise<void>;
  extractSkills: (request: ExtractSkillsRequest) => Promise<ExtractSkillsResponse>;
  summarize: (request: SummarizeChatRequest) => Promise<SummarizeChatResponse>;
  extractMemory: (request: ExtractMemoryRequest) => Promise<ExtractMemoryResponse>;
  parseResume: (request: ParseResumeRequest) => Promise<ParseResumeResponse>;
  speak: (request: SpeakRequest) => Promise<Buffer>;
}

/** Internal understand and generate routes. Health stays on the parent app. */
export function createLlmRouter(deps: LlmRouterDeps): Router {
  const router = Router();
  router.post(
    '/understand',
    asyncHandler((req, res) => postUnderstand(deps, req, res)),
  );
  router.post(
    '/generate',
    asyncHandler((req, res) => postGenerate(deps, req, res)),
  );
  router.post(
    '/extract-skills',
    asyncHandler((req, res) => postExtractSkills(deps, req, res)),
  );
  router.post(
    '/summarize-chat',
    asyncHandler((req, res) => postJson(deps, req, res, () => deps.summarize(readSummary(req.body)))),
  );
  router.post(
    '/extract-memory',
    asyncHandler((req, res) => postJson(deps, req, res, () => deps.extractMemory(readExtract(req.body)))),
  );
  router.post(
    '/parse-resume',
    asyncHandler((req, res) => postJson(deps, req, res, () => deps.parseResume(readResume(req.body)))),
  );
  router.post(
    '/speak',
    asyncHandler((req, res) => postSpeak(deps, req, res)),
  );
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

async function postJson(
  deps: LlmRouterDeps,
  req: Request,
  res: Response,
  run: () => Promise<unknown>,
): Promise<void> {
  try {
    assertConfigured(deps);
    res.setHeader(LLM_PROVIDER_HEADER, LLM_PROVIDER_ID);
    res.status(200).json(await run());
  } catch (error) {
    sendFailure(res, req, error);
  }
}

async function postSpeak(deps: LlmRouterDeps, req: Request, res: Response): Promise<void> {
  try {
    assertConfigured(deps);
    const audio = await deps.speak(parseSpeakRequest(req.body));
    res.setHeader(LLM_PROVIDER_HEADER, LLM_PROVIDER_ID);
    res.status(200).type('audio/mpeg').send(audio);
  } catch (error) {
    sendFailure(res, req, error);
  }
}

function readSummary(body: unknown) {
  return parseSummarizeRequest(body);
}

function readExtract(body: unknown) {
  return parseExtractMemoryRequest(body);
}

function readResume(body: unknown) {
  return parseParseResumeRequest(body);
}

async function postExtractSkills(deps: LlmRouterDeps, req: Request, res: Response): Promise<void> {
  try {
    assertConfigured(deps);
    const body = parseExtractSkillsRequest(req.body);
    res.setHeader(LLM_PROVIDER_HEADER, LLM_PROVIDER_ID);
    res.status(200).json(await deps.extractSkills(body));
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
  if (route.retryAfterSeconds !== null) res.setHeader('Retry-After', String(route.retryAfterSeconds));
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
