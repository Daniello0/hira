import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants/app.constants';

export interface RequestWithId extends Request {
  requestId: string;
}

/** Assigns `X-Request-Id` on every HTTP call and echoes it on the response. */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  /** Copies an incoming id or generates one before the controller runs. */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() === 'http') {
      assignRequestId(context);
    }
    return next.handle();
  }
}

/** Reads the id assigned by `RequestIdInterceptor`. */
export function readRequestId(request: Request): string {
  const requestId = (request as RequestWithId).requestId;
  if (requestId === undefined || requestId.length === 0) {
    return 'unknown';
  }
  return requestId;
}

function assignRequestId(context: ExecutionContext): void {
  const request = context.switchToHttp().getRequest<Request>();
  const response = context.switchToHttp().getResponse<Response>();
  const incoming = request.header(REQUEST_ID_HEADER);
  const requestId = incoming !== undefined && incoming.trim().length > 0 ? incoming : randomUUID();
  (request as RequestWithId).requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
}
