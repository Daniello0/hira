import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { understandCacheKey } from './understand-cache-key';

const request = {
  query: 'remote python',
  history: [{ role: MessageRole.User, content: 'python' }],
  memory: [{ content: 'Minsk' }],
};

describe('understandCacheKey', () => {
  it('hashes model, schema version, and canonical input under its own prefix', () => {
    const key = understandCacheKey('model-a', '1', request);
    expect(key.startsWith('llm:understand:')).toBe(true);
    expect(key.slice('llm:understand:'.length)).toMatch(/^[a-f0-9]{64}$/);
    expect(understandCacheKey('model-a', '1', request)).toBe(key);
    expect(understandCacheKey('model-b', '1', request)).not.toBe(key);
    expect(understandCacheKey('model-a', '2', request)).not.toBe(key);
  });

  it('ignores object key order and follows array order', () => {
    const reordered = {
      memory: [{ content: 'Minsk' }],
      query: 'remote python',
      history: [{ content: 'python', role: MessageRole.User }],
    };
    expect(understandCacheKey('model-a', '1', reordered)).toBe(
      understandCacheKey('model-a', '1', request),
    );
    const swapped = {
      ...request,
      history: [{ role: MessageRole.User, content: 'java' }],
    };
    expect(understandCacheKey('model-a', '1', swapped)).not.toBe(
      understandCacheKey('model-a', '1', request),
    );
  });
});
