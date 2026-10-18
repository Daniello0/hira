import {
  RetrievalBranch,
  type HardConstraints,
  type RetrievalOptions,
  type SearchIntent,
} from '@hira/contracts';
import { MAX_RESULT_LIMIT } from './search.constants';
import { emptyIntent } from './run-branches';

export interface ParsedSearch {
  intent: SearchIntent;
  options?: RetrievalOptions;
}

/** Reads the search body. A missing limit is accepted; an out-of-range limit is not. */
export function readSearchRequest(body: unknown): ParsedSearch | null {
  if (!isRecord(body)) return null;
  const intent = readIntent(body.intent);
  if (intent === null || !validLimit(body.limit)) return null;
  const options = readOptions(body.options);
  if (options === 'invalid') return null;
  return { intent, options };
}

function readIntent(value: unknown): SearchIntent | null {
  if (!isRecord(value) || typeof value.rewrittenQuery !== 'string') return null;
  if (!validConstraints(value.hardConstraints)) return null;
  const intent = emptyIntent(value.rewrittenQuery);
  intent.hardConstraints = constraintsOf(value.hardConstraints);
  return intent;
}

function readOptions(value: unknown): RetrievalOptions | undefined | 'invalid' {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !validBranches(value.branches)) return 'invalid';
  if (value.branches === undefined) return {};
  return { branches: value.branches as RetrievalBranch[] };
}

function validLimit(value: unknown): boolean {
  if (value === undefined) return true;
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_RESULT_LIMIT;
}

function validBranches(value: unknown): boolean {
  if (value === undefined) return true;
  return Array.isArray(value) && value.every((item) => knownBranch(item));
}

function knownBranch(value: unknown): boolean {
  return value === RetrievalBranch.Lexical || value === RetrievalBranch.Dense || value === RetrievalBranch.Graph;
}

function validConstraints(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return (
    stringList(value.workFormat) &&
    stringList(value.employment) &&
    stringList(value.location) &&
    validSalary(value.salaryMin)
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
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function validSalary(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
