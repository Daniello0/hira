import { createApiErrorResponse } from '@hira/contracts';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Inject } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Logger } from 'pino';
import { INTERNAL_ERROR_CODE, INTERNAL_ERROR_MESSAGE, LOGGER } from '../constants/app.constants';
import { readRequestId } from '../interceptors/request-id.interceptor';

/** Turns unhandled errors into `ApiErrorResponse` and leaves HTTP exceptions as thrown. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER) private readonly logger: Logger) {}

  /** Writes the HTTP response for a thrown exception. */
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    if (exception instanceof HttpException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }
    this.logUnexpected(exception, request);
    response.status(500).json(unexpectedBody(request));
  }

  private logUnexpected(exception: unknown, request: Request): void {
    this.logger.error({ err: exception, requestId: readRequestId(request) }, 'unhandled error');
  }
}

function unexpectedBody(request: Request) {
  return createApiErrorResponse(
    INTERNAL_ERROR_CODE,
    INTERNAL_ERROR_MESSAGE,
    readRequestId(request),
  );
}
