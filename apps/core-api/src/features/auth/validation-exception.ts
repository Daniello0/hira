import { createApiErrorResponse } from '@hira/contracts';
import { HttpStatus, ValidationPipe, type Type, type ValidationError } from '@nestjs/common';
import {
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_MESSAGE,
} from '../../common/constants/app.constants';
import { ApiHttpException } from '../../common/filters/api-http.exception';

/**
 * Body pipe with an explicit metatype.
 * Vitest does not emit method `design:paramtypes`, so a global pipe cannot see the DTO in tests.
 */
export function validatedBody(metatype: Type): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    expectedType: metatype,
    exceptionFactory: validationException,
  });
}

/** Turns class-validator output into the shared error body. The filter fills `requestId`. */
export function validationException(errors: ValidationError[]): ApiHttpException {
  return new ApiHttpException(
    HttpStatus.BAD_REQUEST,
    createApiErrorResponse(VALIDATION_ERROR_CODE, VALIDATION_ERROR_MESSAGE, '', {
      fields: fieldMessages(errors),
    }),
  );
}

function fieldMessages(errors: ValidationError[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const error of errors) {
    const message = firstMessage(error);
    if (message !== undefined) fields[error.property] = message;
  }
  return fields;
}

function firstMessage(error: ValidationError): string | undefined {
  if (error.constraints === undefined) return undefined;
  return Object.values(error.constraints)[0];
}
