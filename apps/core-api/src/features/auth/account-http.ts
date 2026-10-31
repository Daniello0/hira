import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_UNAUTHORIZED, VALIDATION_ERROR_CODE } from '../../common/constants/app.constants';
import { ApiHttpException } from '../../common/filters/api-http.exception';
import { apiError } from '../auth/auth-http';
import { AccountRequiredError } from '../auth/account-required.error';
import { UnauthorizedError } from '../auth/auth.errors';
import { PlanLimitError } from '../billing/plan-limit.error';
import { CallMissingError } from '../call/call.errors';
import {
  ACCOUNT_REQUIRED,
  CALL_ENDED,
  CALL_NOT_FOUND,
  DOCUMENT_NOT_FOUND,
  MEMORY_NOT_FOUND,
  PLAN_LIMIT_REACHED,
  SKILL_EXISTS,
  SKILL_NOT_FOUND,
  SUGGESTION_NOT_FOUND,
} from '../memory/memory.constants';
import { CallEndedError } from '../search-orchestrator/orchestrate-search';
import {
  COLLECTION_NOT_FOUND,
  DEFAULT_COLLECTION_PROTECTED,
  FAVORITE_NOT_FOUND,
  VACANCY_NOT_FOUND,
} from '../favorite/favorite.constants';
import {
  CollectionMissingError,
  DefaultCollectionProtectedError,
  FavoriteInputError,
  FavoriteMissingError,
  VacancyMissingError,
} from '../favorite/favorite.errors';
import { DocumentNotFoundError, LibraryInputError } from '../library/library.service';
import { EmptyMemoryPatchError, MemoryNotFoundError } from '../memory/memory.service';
import { SkillExistsError, SkillMissingError, SuggestionClosedError } from '../profile/profile.service';

/** Maps account, library, and profile failures onto the shared error body. */
export function mapAccountError(error: unknown, request: Request): ApiHttpException | null {
  if (error instanceof PlanLimitError) {
    return apiError(HttpStatus.FORBIDDEN, PLAN_LIMIT_REACHED, error.message, request, { feature: error.feature, requiredPlan: error.requiredPlan });
  }
  if (error instanceof UnauthorizedError) return apiError(HttpStatus.UNAUTHORIZED, AUTH_UNAUTHORIZED, error.message, request);
  if (error instanceof AccountRequiredError) return apiError(HttpStatus.FORBIDDEN, ACCOUNT_REQUIRED, error.message, request);
  if (error instanceof LibraryInputError) return apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, error.message, request);
  if (error instanceof DocumentNotFoundError) return apiError(HttpStatus.NOT_FOUND, DOCUMENT_NOT_FOUND, error.message, request);
  if (error instanceof MemoryNotFoundError) return apiError(HttpStatus.NOT_FOUND, MEMORY_NOT_FOUND, error.message, request);
  if (error instanceof EmptyMemoryPatchError) return apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, error.message, request);
  if (error instanceof SkillExistsError) return apiError(HttpStatus.CONFLICT, SKILL_EXISTS, error.message, request);
  if (error instanceof SkillMissingError) return apiError(HttpStatus.NOT_FOUND, SKILL_NOT_FOUND, error.message, request);
  if (error instanceof SuggestionClosedError) return apiError(HttpStatus.NOT_FOUND, SUGGESTION_NOT_FOUND, error.message, request);
  if (error instanceof CallEndedError) return apiError(HttpStatus.BAD_REQUEST, CALL_ENDED, error.message, request);
  if (error instanceof CallMissingError) return apiError(HttpStatus.NOT_FOUND, CALL_NOT_FOUND, error.message, request);
  if (error instanceof DefaultCollectionProtectedError) {
    return apiError(HttpStatus.BAD_REQUEST, DEFAULT_COLLECTION_PROTECTED, error.message, request);
  }
  if (error instanceof FavoriteInputError) return apiError(HttpStatus.BAD_REQUEST, VALIDATION_ERROR_CODE, error.message, request);
  if (error instanceof FavoriteMissingError) return apiError(HttpStatus.NOT_FOUND, FAVORITE_NOT_FOUND, error.message, request);
  if (error instanceof CollectionMissingError) return apiError(HttpStatus.NOT_FOUND, COLLECTION_NOT_FOUND, error.message, request);
  if (error instanceof VacancyMissingError) return apiError(HttpStatus.NOT_FOUND, VACANCY_NOT_FOUND, error.message, request);
  return null;
}
