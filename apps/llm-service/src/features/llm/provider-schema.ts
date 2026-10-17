import { isRecord } from '../../common/utils/is-record';

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

/** Makes a Zod JSON Schema acceptable to strict structured output. */
export function enforceProviderSchema(value: unknown): Record<string, unknown> {
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
