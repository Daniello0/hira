import {
  EmploymentType,
  IntentType,
  QueryComplexity,
  RetrievalBranch,
  SeniorityLevel,
  WorkFormat,
} from '@hira/contracts';
import { MAX_SEARCH_LIMIT } from './search.constants';

const SKILL_SCHEMA = {
  type: 'object',
  required: ['surface', 'required'],
  properties: {
    surface: { type: 'string' },
    canonicalId: { type: 'string', nullable: true },
    required: { type: 'boolean' },
  },
};

const INTENT_SCHEMA = {
  type: 'object',
  required: ['rewrittenQuery', 'role', 'skills', 'seniority', 'hardConstraints', 'softConstraints', 'complexity', 'intentType'],
  properties: {
    rewrittenQuery: { type: 'string', minLength: 1 },
    role: { type: 'string', nullable: true },
    skills: { type: 'array', items: SKILL_SCHEMA },
    seniority: { type: 'string', enum: Object.values(SeniorityLevel), nullable: true },
    hardConstraints: {
      type: 'object',
      properties: {
        workFormat: { type: 'array', items: { type: 'string', enum: Object.values(WorkFormat) } },
        employment: { type: 'array', items: { type: 'string', enum: Object.values(EmploymentType) } },
        location: { type: 'array', items: { type: 'string' } },
        salaryMin: { type: 'number', minimum: 0 },
        includeForeignRemote: { type: 'boolean' },
      },
    },
    softConstraints: { type: 'object', additionalProperties: { type: 'number' } },
    complexity: { type: 'string', enum: Object.values(QueryComplexity) },
    intentType: { type: 'string', enum: Object.values(IntentType) },
  },
};

/** Swagger body of `POST /api/v1/search` (`RetrievalRequest`; `userId` is ignored). */
export const RETRIEVAL_BODY_SCHEMA = {
  type: 'object',
  required: ['intent'],
  properties: {
    intent: INTENT_SCHEMA,
    limit: { type: 'integer', minimum: 1, maximum: MAX_SEARCH_LIMIT },
    options: {
      type: 'object',
      properties: {
        branches: { type: 'array', items: { type: 'string', enum: Object.values(RetrievalBranch) } },
        rerank: { type: 'boolean' },
        personalize: { type: 'boolean' },
        branchWeights: { type: 'object', additionalProperties: { type: 'number' } },
      },
    },
  },
};
