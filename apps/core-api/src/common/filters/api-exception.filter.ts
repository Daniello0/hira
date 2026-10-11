import { createApiErrorResponse, type ApiErrorResponse } from '@hira/contracts';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Logger } from 'pino';
import {
  INTERNAL_ERROR_CODE,
  INTERNAL_ERROR_MESSAGE,
  LOGGER,
  RATE_LIMIT_ERROR_CODE,
  VALIDATION_ERROR_CODE,
} from '../constants/app.constants';
import { readRequestId } from '../interceptors/request-id.interceptor';
import { ApiHttpException } from './api-http.exception';

/** Turns thrown errors into `ApiErrorResponse` and copies `Retry-After` when a limiter set one. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  /** Writes the HTTP response for a thrown exception. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    if (exception instanceof HttpException) {
      this.writeHttp(exception, request, response);
      return;
    }
    this.logUnexpected(exception, request);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(unexpectedBody(request));
  }

  private writeHttp(exception: HttpException, request: Request, response: Response): void {
    if (exception instanceof ApiHttpException && exception.retryAfterSeconds !== undefined) {
      response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    }
    response.status(exception.getStatus()).json(normalizeBody(exception, request));
  }

  private logUnexpected(exception: unknown, request: Request): void {
    this.logger.error({ err: exception, requestId: readRequestId(request) }, 'unhandled error');
  }
}

function normalizeBody(exception: HttpException, request: Request): ApiErrorResponse {
  const raw = exception.getResponse();
  if (isApiErrorBody(raw)) return withRequestId(raw, request);
  return createApiErrorResponse(
    codeForStatus(exception.getStatus()),
    textMessage(raw),
    readRequestId(request),
  );
}

function unexpectedBody(request: Request): ApiErrorResponse {
  return createApiErrorResponse(
    INTERNAL_ERROR_CODE,
    INTERNAL_ERROR_MESSAGE,
    readRequestId(request),
  );
}

function isApiErrorBody(value: unknown): value is ApiErrorResponse {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as ApiErrorResponse;
  return typeof body.errorCode === 'string' && typeof body.message === 'string';
}

function withRequestId(body: ApiErrorResponse, request: Request): ApiErrorResponse {
  if (typeof body.requestId === 'string' && body.requestId.length > 0) return body;
  return { ...body, requestId: readRequestId(request) };
}

function codeForStatus(status: number): string {
  if (status === HttpStatus.TOO_MANY_REQUESTS) return RATE_LIMIT_ERROR_CODE;
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) return INTERNAL_ERROR_CODE;
  return VALIDATION_ERROR_CODE;
}

function textMessage(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) return raw;
  if (typeof raw === 'object' && raw !== null && 'message' in raw) {
    const message = (raw as { message: unknown }).message;
    if (typeof message === 'string' && message.length > 0) return message;
  }
  return INTERNAL_ERROR_MESSAGE;
}
