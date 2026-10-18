import type { ApiErrorResponse } from '@hira/contracts';
import { HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AUTH_UNAUTHORIZED,
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
  RATE_LIMIT_ERROR_CODE,
  VALIDATION_ERROR_CODE,
} from '../../common/constants/app.constants';
import { ApiHttpException } from '../../common/filters/api-http.exception';
import { apiError } from '../auth/auth-http';
import { UnauthorizedError } from '../auth/auth.errors';
import {
  CHAT_NOT_FOUND,
  SEARCH_UPSTREAM_UNAVAILABLE,
  SSE_EVENT,
} from './chat.constants';
import {
  ArchivedChatError,
  ChatNotFoundError,
  DemoChatLimitError,
  EmptyChatPatchError,
  InvalidCursorError,
  InvalidSearchError,
  QuotaDeniedError,
  SearchUpstreamError,
} from './chat.errors';

/** Opens the SSE response. Call this after the user message is stored, before understand. */
export function openSse(response: Response): void {
  response.status(HttpStatus.OK);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache');
  response.flushHeaders?.();
}

/** Writes one SSE event. */
export function writeSse(response: Response, event: string, data: unknown): void {
  response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Maps dialogue failures onto the shared error body. Unknown errors return null. */
export function mapChatError(error: unknown, request: Request): ApiHttpException | null {
  if (error instanceof ChatNotFoundError) return apiError(HttpStatus.NOT_FOUND, CHAT_NOT_FOUND, error.message, request);
  if (error instanceof QuotaDeniedError) return quota(error, request);
  if (error instanceof DemoChatLimitError) return apiError(HttpStatus.TOO_MANY_REQUESTS, RATE_LIMIT_ERROR_CODE, error.message, request);
  if (error instanceof SearchUpstreamError) {
    return apiError(HttpStatus.SERVICE_UNAVAILABLE, SEARCH_UPSTREAM_UNAVAILABLE, error.message, request);
  }
  if (error instanceof UnauthorizedError) return apiError(HttpStatus.UNAUTHORIZED, AUTH_UNAUTHORIZED, error.message, request);
  if (isValidation(error)) return apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, error.message, request);
  return null;
}

/** Writes a JSON error, or an SSE error when the stream is already open. */
export function failStream(error: unknown, request: Request, response: Response): void {
  const http = mapChatError(error, request) ?? unexpected(request);
  if (response.headersSent) {
    writeSse(response, SSE_EVENT.error, http.getResponse());
    response.end();
    return;
  }
  sendJson(http, response);
}

function quota(error: QuotaDeniedError, request: Request): ApiHttpException {
  return apiError(
    HttpStatus.TOO_MANY_REQUESTS,
    RATE_LIMIT_ERROR_CODE,
    error.message,
    request,
    undefined,
    error.retryAfterSeconds ?? undefined,
  );
}

function isValidation(error: unknown): error is Error {
  return (
    error instanceof InvalidCursorError ||
    error instanceof InvalidSearchError ||
    error instanceof EmptyChatPatchError ||
    error instanceof ArchivedChatError
  );
}

function unexpected(request: Request): ApiHttpException {
  return apiError(HttpStatus.INTERNAL_SERVER_ERROR, INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE, request);
}

function sendJson(http: ApiHttpException, response: Response): void {
  if (http.retryAfterSeconds !== undefined) response.setHeader('Retry-After', String(http.retryAfterSeconds));
  const body = http.getResponse();
  response.status(http.getStatus()).json(isApiBody(body) ? body : {});
}

function isApiBody(value: unknown): value is ApiErrorResponse {
  return typeof value === 'object' && value !== null && 'errorCode' in value;
}
