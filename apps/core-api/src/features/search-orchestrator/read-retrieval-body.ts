import {
  EmploymentType,
  IntentType,
  QueryComplexity,
  RetrievalBranch,
  SeniorityLevel,
  WorkFormat,
  type RetrievalOptions,
  type RetrievalRequest,
  type SearchIntent,
} from '@hira/contracts';
import { MAX_SEARCH_LIMIT } from './search.constants';

/**
 * Reads `POST /api/v1/search`. A client-supplied `userId` is ignored.
 * The whole intent shape is checked here, before any quota is spent; null means 400.
 */
export function readRetrievalBody(body: unknown): RetrievalRequest | null {
  if (!isRecord(body) || !isIntent(body.intent)) return null;
  const limit = readLimit(body.limit);
  if (limit === 'invalid' || (body.options !== undefined && !isOptions(body.options))) return null;
  return {
    intent: body.intent,
    ...(limit === undefined ? {} : { limit }),
    ...(body.options === undefined ? {} : { options: body.options as RetrievalOptions }),
  };
}

function isIntent(value: unknown): value is SearchIntent {
  if (!isRecord(value)) return false;
  if (typeof value.rewrittenQuery !== 'string' || value.rewrittenQuery.trim().length === 0) return false;
  if (!isNullableString(value.role) || !isSkills(value.skills)) return false;
  if (value.seniority !== null && !isOneOf(value.seniority, SeniorityLevel)) return false;
  if (!isHardConstraints(value.hardConstraints) || !isNumberRecord(value.softConstraints)) return false;
  return isOneOf(value.complexity, QueryComplexity) && isOneOf(value.intentType, IntentType);
}

function isSkills(value: unknown): boolean {
  return Array.isArray(value) && value.every((skill) =>
    isRecord(skill) && typeof skill.surface === 'string' && skill.surface.length > 0
      && typeof skill.required === 'boolean' && isNullableString(skill.canonicalId ?? null));
}

function isHardConstraints(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.workFormat !== undefined && !isEnumList(value.workFormat, WorkFormat)) return false;
  if (value.employment !== undefined && !isEnumList(value.employment, EmploymentType)) return false;
  if (value.location !== undefined && !(Array.isArray(value.location) && value.location.every((item) => typeof item === 'string'))) return false;
  if (value.salaryMin !== undefined && !(typeof value.salaryMin === 'number' && value.salaryMin >= 0)) return false;
  return value.includeForeignRemote === undefined || typeof value.includeForeignRemote === 'boolean';
}

function isOptions(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.branches !== undefined && !isEnumList(value.branches, RetrievalBranch)) return false;
  if (value.rerank !== undefined && typeof value.rerank !== 'boolean') return false;
  if (value.personalize !== undefined && typeof value.personalize !== 'boolean') return false;
  return value.branchWeights === undefined || isNumberRecord(value.branchWeights);
}

function readLimit(value: unknown): number | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_SEARCH_LIMIT) {
    return 'invalid';
  }
  return value;
}

function isEnumList(value: unknown, values: Record<string, string>): boolean {
  return Array.isArray(value) && value.every((item) => isOneOf(item, values));
}

function isOneOf(value: unknown, values: Record<string, string>): boolean {
  return typeof value === 'string' && Object.values(values).includes(value);
}

function isNumberRecord(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isNullableString(value: unknown): boolean {
  return value === null || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
