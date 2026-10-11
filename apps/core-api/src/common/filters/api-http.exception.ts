import type { ApiErrorResponse } from '@hira/contracts';
import { HttpException } from '@nestjs/common';

/** HTTP error whose body is already an `ApiErrorResponse`. */
export class ApiHttpException extends HttpException {
  constructor(
    status: number,
    body: ApiErrorResponse,
    readonly retryAfterSeconds?: number,
  ) {
    super(body, status);
  }
}
