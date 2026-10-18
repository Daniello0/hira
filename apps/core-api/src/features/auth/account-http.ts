import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_UNAUTHORIZED, VALIDATION_ERROR_CODE } from '../../common/constants/app.constants';
import { ApiHttpException } from '../../common/filters/api-http.exception';
import { apiError } from '../auth/auth-http';
import { AccountRequiredError } from '../auth/account-required.error';
import { UnauthorizedError } from '../auth/auth.errors';
import {
  ACCOUNT_REQUIRED,
  CALL_NOT_FOUND,
  DOCUMENT_NOT_FOUND,
  SKILL_EXISTS,
  SUGGESTION_NOT_FOUND,
} from '../memory/memory.constants';
import { CallEndedError } from '../search-orchestrator/orchestrate-search';
import { LibraryInputError } from '../library/library.service';
import { SkillExistsError, SuggestionClosedError } from '../profile/profile.service';

/** Maps account, library, and profile failures onto the shared error body. */
export function mapAccountError(error: unknown, request: Request): ApiHttpException | null {
  if (error instanceof UnauthorizedError) return apiError(HttpStatus.UNAUTHORIZED, AUTH_UNAUTHORIZED, error.message, request);
  if (error instanceof AccountRequiredError) return apiError(HttpStatus.FORBIDDEN, ACCOUNT_REQUIRED, error.message, request);
  if (error instanceof LibraryInputError) return apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, error.message, request);
  if (error instanceof SkillExistsError) return apiError(HttpStatus.CONFLICT, SKILL_EXISTS, error.message, request);
  if (error instanceof SuggestionClosedError) return apiError(HttpStatus.NOT_FOUND, SUGGESTION_NOT_FOUND, error.message, request);
  if (error instanceof CallEndedError) return apiError(HttpStatus.BAD_REQUEST, CALL_NOT_FOUND, error.message, request);
  return null;
}

export const DOCUMENT_MISSING = DOCUMENT_NOT_FOUND;
export const CALL_MISSING = CALL_NOT_FOUND;
