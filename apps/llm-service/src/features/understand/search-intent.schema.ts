import {
  EmploymentType,
  IntentType,
  QueryComplexity,
  SeniorityLevel,
  WorkFormat,
} from '@hira/contracts';
import { z } from 'zod';
import { isRecord } from '../../common/utils/is-record';

const modelSkillSchema = z
  .object({
    surface: z.string().min(1),
    required: z.boolean(),
  })
  .strict();

const softConstraintSchema = z
  .object({
    key: z.string().min(1),
    weight: z.number().min(0).max(1),
  })
  .strict();

const hardConstraintsSchema = z
  .object({
    workFormat: z.array(stringEnum(Object.values(WorkFormat))).nullable(),
    employment: z.array(stringEnum(Object.values(EmploymentType))).nullable(),
    location: z.array(z.string().min(1)).nullable(),
    salaryMin: z.number().min(0).nullable(),
  })
  .strict();

const modelIntentSchema = z
  .object({
    rewrittenQuery: z.string().min(1),
    role: z.string().min(1).nullable(),
    skills: z.array(modelSkillSchema),
    seniority: stringEnum(Object.values(SeniorityLevel)).nullable(),
    hardConstraints: hardConstraintsSchema,
    softConstraints: z.array(softConstraintSchema),
    complexity: stringEnum(Object.values(QueryComplexity)),
    intentType: stringEnum(Object.values(IntentType)),
  })
  .strict();

export type ModelIntent = z.infer<typeof modelIntentSchema>;

/** Parses a model payload. Throws when the object breaks the strict schema. */
export function parseModelIntent(value: unknown): ModelIntent {
  return modelIntentSchema.parse(value);
}

/**
 * JSON Schema sent to OpenRouter.
 * Zod still enforces string length and numeric bounds; those keywords are removed
 * because strict structured output rejects them.
 */
export function buildSearchIntentJsonSchema(): Record<string, unknown> {
  return enforceProviderSchema(z.toJSONSchema(modelIntentSchema));
}

function stringEnum<T extends string>(values: readonly T[]) {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('enum has no values');
  return z.enum([first, ...rest]);
}

const DROPPED_SCHEMA_KEYS = new Set([
  '$schema',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'minItems',
  'maxItems',
  'pattern',
  'format',
  'default',
]);

function enforceProviderSchema(value: unknown): Record<string, unknown> {
  return walkSchema(value) as Record<string, unknown>;
}

function walkSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walkSchema);
  if (!isRecord(value)) return value;
  const next = dropBounds(value);
  if (next.type === 'object' && isRecord(next.properties)) {
    next.additionalProperties = false;
    next.required = Object.keys(next.properties);
  }
  return next;
}

function dropBounds(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!DROPPED_SCHEMA_KEYS.has(key)) next[key] = walkSchema(child);
  }
  return next;
}
