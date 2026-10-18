import {
  QueryComplexity,
  RetrievalBranch,
  SeniorityLevel,
  type HardConstraints,
  type RetrievalOptions,
  type SearchIntent,
  type SkillMention,
} from '@hira/contracts';
import { DEFAULT_RESULT_LIMIT, MAX_RESULT_LIMIT, USER_ID_PATTERN } from './search.constants';
import { emptyIntent } from './run-branches';

export interface ParsedSearch {
  intent: SearchIntent;
  userId?: string;
  limit: number;
  options?: RetrievalOptions;
}

/** Reads the search body. A missing limit becomes 10; an out-of-range limit is rejected. */
export function readSearchRequest(body: unknown): ParsedSearch | null {
  if (!isRecord(body)) return null;
  const intent = readIntent(body.intent);
  const limit = limitOf(body.limit);
  const userId = readUserId(body.userId);
  const options = readOptions(body.options);
  if (intent === null || limit === null || userId === 'invalid' || options === 'invalid')
    return null;
  return { intent, limit, userId, options };
}

function readIntent(value: unknown): SearchIntent | null {
  if (!isRecord(value) || typeof value.rewrittenQuery !== 'string') return null;
  if (!validConstraints(value.hardConstraints)) return null;
  const skills = readSkills(value.skills);
  const complexity = readComplexity(value.complexity);
  const seniority = readSeniority(value.seniority);
  if (skills === null || complexity === null || seniority === 'invalid') return null;
  return {
    ...emptyIntent(value.rewrittenQuery),
    skills,
    complexity,
    seniority,
    hardConstraints: constraintsOf(value.hardConstraints),
  };
}

function readSkills(value: unknown): SkillMention[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const skills: SkillMention[] = [];
  for (const item of value) {
    const skill = readSkill(item);
    if (skill === null) return null;
    skills.push(skill);
  }
  return skills;
}

function readSkill(value: unknown): SkillMention | null {
  if (!isRecord(value) || typeof value.surface !== 'string' || typeof value.required !== 'boolean')
    return null;
  if (
    !('canonicalId' in value) ||
    (value.canonicalId !== null && typeof value.canonicalId !== 'string')
  )
    return null;
  return { surface: value.surface, canonicalId: value.canonicalId, required: value.required };
}

function readComplexity(value: unknown): QueryComplexity | null {
  if (value === undefined) return QueryComplexity.Simple;
  return knownValue(QueryComplexity, value);
}

function readSeniority(value: unknown): SeniorityLevel | null | 'invalid' {
  if (value === undefined || value === null) return null;
  return knownValue(SeniorityLevel, value) ?? 'invalid';
}

function knownValue<T extends Record<string, string>>(
  catalog: T,
  value: unknown,
): T[keyof T] | null {
  if (typeof value !== 'string' || !Object.values(catalog).includes(value)) return null;
  return value as T[keyof T];
}

function readUserId(value: unknown): string | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !USER_ID_PATTERN.test(value)) return 'invalid';
  return value;
}

function readOptions(value: unknown): RetrievalOptions | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !validBranches(value.branches) || !validFlag(value.rerank))
    return 'invalid';
  if (!validWeights(value.branchWeights) || !validFlag(value.personalize)) return 'invalid';
  return optionsOf(value);
}

function optionsOf(value: Record<string, unknown>): RetrievalOptions {
  return {
    branches: value.branches as RetrievalBranch[] | undefined,
    rerank: value.rerank as boolean | undefined,
    branchWeights: value.branchWeights as RetrievalOptions['branchWeights'],
    personalize: value.personalize as boolean | undefined,
  };
}

function limitOf(value: unknown): number | null {
  if (value === undefined) return DEFAULT_RESULT_LIMIT;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAX_RESULT_LIMIT)
    return null;
  return Number(value);
}

function validFlag(value: unknown): boolean {
  return value === undefined || typeof value === 'boolean';
}

function validWeights(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return Object.entries(value).every(([key, weight]) => knownBranch(key) && numeric(weight));
}

function validBranches(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((item) => knownBranch(item));
}

function knownBranch(value: unknown): boolean {
  return (
    value === RetrievalBranch.Lexical ||
    value === RetrievalBranch.Dense ||
    value === RetrievalBranch.Graph
  );
}

function numeric(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function validConstraints(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    stringList(value.workFormat) &&
    stringList(value.employment) &&
    stringList(value.location) &&
    (value.salaryMin === undefined || numeric(value.salaryMin))
  );
}

function constraintsOf(value: unknown): HardConstraints {
  if (!isRecord(value)) return {};
  return {
    workFormat: value.workFormat as HardConstraints['workFormat'],
    employment: value.employment as HardConstraints['employment'],
    location: value.location as HardConstraints['location'],
    salaryMin: value.salaryMin as HardConstraints['salaryMin'],
  };
}

function stringList(value: unknown): boolean {
  return (
    value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
