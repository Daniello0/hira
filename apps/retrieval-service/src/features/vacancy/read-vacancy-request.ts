import { UUID_PATTERN } from '../../common/constants/app.constants';
import { SIMILAR_DEFAULT_LIMIT, SIMILAR_MAX_LIMIT } from './vacancy.constants';

/** Parsed body of `POST /internal/v1/similar`. */
export interface SimilarRequest {
  vacancyId: string;
  limit: number;
}

/** Parsed body of `POST /internal/v1/skill-gap`. */
export interface SkillGapRequest {
  vacancyId: string;
  userId: string;
}

/** `{ vacancyId: uuid, limit?: 1..30 }`; a missing limit becomes 10. Null when invalid. */
export function readSimilarRequest(body: unknown): SimilarRequest | null {
  if (!isRecord(body) || !isUuid(body.vacancyId)) return null;
  const limit = limitOf(body.limit);
  if (limit === null) return null;
  return { vacancyId: body.vacancyId, limit };
}

/** `{ vacancyId: uuid, userId: uuid }`. Null when invalid. */
export function readSkillGapRequest(body: unknown): SkillGapRequest | null {
  if (!isRecord(body) || !isUuid(body.vacancyId) || !isUuid(body.userId)) return null;
  return { vacancyId: body.vacancyId, userId: body.userId };
}

function limitOf(value: unknown): number | null {
  if (value === undefined) return SIMILAR_DEFAULT_LIMIT;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > SIMILAR_MAX_LIMIT)
    return null;
  return Number(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
