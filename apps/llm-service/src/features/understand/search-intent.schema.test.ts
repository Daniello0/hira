import { IntentType, QueryComplexity } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { validModelIntent } from './understand.fixture';
import { buildSearchIntentJsonSchema, parseModelIntent } from './search-intent.schema';

describe('search intent json schema', () => {
  it('is a strict object whose enums come from the contracts', () => {
    const schema = buildSearchIntentJsonSchema() as SchemaNode;
    expect(schema.type).toBe('object');
    expect(schema.additionalProperties).toBe(false);
    expect(new Set(schema.required)).toEqual(
      new Set([
        'rewrittenQuery',
        'role',
        'skills',
        'seniority',
        'hardConstraints',
        'softConstraints',
        'complexity',
        'intentType',
      ]),
    );
    expect(schema.properties?.softConstraints?.type).toBe('array');
    expect(schema.properties?.intentType?.enum).toEqual(
      expect.arrayContaining([...Object.values(IntentType)]),
    );
    expect(schema.properties?.complexity?.enum).toEqual(
      expect.arrayContaining([...Object.values(QueryComplexity)]),
    );
    const items = schema.properties?.softConstraints?.items;
    expect(items?.type).toBe('object');
    expect(items?.additionalProperties).toBe(false);
    expect(items?.required).toEqual(expect.arrayContaining(['key', 'weight']));
    expect(JSON.stringify(schema)).not.toContain('canonicalId');
    assertStrictObjects(schema);
  });
});

describe('parseModelIntent', () => {
  it('accepts a payload that matches the model schema', () => {
    expect(parseModelIntent(validModelIntent())).toMatchObject({
      rewrittenQuery: 'Junior Python developer, remote, Minsk',
      intentType: IntentType.Search,
    });
  });

  it('rejects an unknown intent, an extra field, a weight above 1, and an empty rewrite', () => {
    const unknown = validModelIntent();
    unknown.intentType = 'NOPE';
    expect(() => parseModelIntent(unknown)).toThrow();

    const extra = validModelIntent();
    extra.note = 'nope';
    expect(() => parseModelIntent(extra)).toThrow();

    const heavy = validModelIntent();
    heavy.softConstraints = [{ key: 'medicine', weight: 1.5 }];
    expect(() => parseModelIntent(heavy)).toThrow();

    const empty = validModelIntent();
    empty.rewrittenQuery = '';
    expect(() => parseModelIntent(empty)).toThrow();
  });

  it('rejects a skill that invents canonicalId', () => {
    const invented = validModelIntent();
    invented.skills = [{ surface: 'Python', required: true, canonicalId: 'skill-1' }];
    expect(() => parseModelIntent(invented)).toThrow();
  });

  it('rejects a missing field and a non-json object', () => {
    const missing = validModelIntent();
    delete missing.complexity;
    expect(() => parseModelIntent(missing)).toThrow();
    expect(() => parseModelIntent([])).toThrow();
  });
});

interface SchemaNode {
  type?: string;
  enum?: string[];
  additionalProperties?: boolean;
  required?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  anyOf?: SchemaNode[];
}

function assertStrictObjects(schema: SchemaNode): void {
  if (schema.type === 'object' && schema.properties !== undefined) {
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(expect.arrayContaining(Object.keys(schema.properties)));
    for (const child of Object.values(schema.properties)) assertStrictObjects(child);
  }
  if (schema.items !== undefined) assertStrictObjects(schema.items);
  for (const child of schema.anyOf ?? []) assertStrictObjects(child);
}
