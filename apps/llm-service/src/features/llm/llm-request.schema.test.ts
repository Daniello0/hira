import { IntentType, MessageRole, QueryComplexity } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { parseGenerateRequest, parseUnderstandRequest } from './llm-request.schema';

const intent = {
  rewrittenQuery: 'remote python',
  role: null,
  skills: [{ surface: 'Python', required: true, canonicalId: null }],
  seniority: null,
  hardConstraints: {},
  softConstraints: { medicine: 0.4 },
  complexity: QueryComplexity.Simple,
  intentType: IntentType.Search,
};

describe('parseUnderstandRequest', () => {
  it('accepts a query with history and memory', () => {
    expect(
      parseUnderstandRequest({
        query: '  remote?  ',
        history: [{ role: MessageRole.User, content: 'python' }],
        memory: [{ content: 'Minsk' }],
      }),
    ).toEqual({
      query: 'remote?',
      history: [{ role: MessageRole.User, content: 'python' }],
      memory: [{ content: 'Minsk' }],
    });
  });

  it('rejects an empty query, a system turn, and an unknown field', () => {
    expect(() => parseUnderstandRequest({ query: '   ', history: [], memory: [] })).toThrow();
    expect(() =>
      parseUnderstandRequest({
        query: 'hi',
        history: [{ role: MessageRole.System, content: 'secret' }],
        memory: [],
      }),
    ).toThrow();
    expect(() =>
      parseUnderstandRequest({ query: 'hi', history: [], memory: [], extra: true }),
    ).toThrow();
    expect(() => parseUnderstandRequest(null)).toThrow();
  });
});

describe('parseGenerateRequest', () => {
  it('accepts an intent whose soft constraints are a record', () => {
    const parsed = parseGenerateRequest({ intent, results: [], history: [] });
    expect(parsed.intent.softConstraints).toEqual({ medicine: 0.4 });
    expect(parsed.intent.skills[0]?.canonicalId).toBeNull();
  });

  it('rejects a missing intent and a result without a title', () => {
    expect(() => parseGenerateRequest({ results: [], history: [] })).toThrow();
    expect(() =>
      parseGenerateRequest({
        intent,
        history: [],
        results: [{ vacancy: { description: 'secret' }, score: 1, explanation: {}, retrievedBy: [] }],
      }),
    ).toThrow();
  });
});
