import { describe, expect, it } from 'vitest';
import { extractSkillsCacheKey } from './extract-skills-cache-key';

const vacancy = { id: 'v1', title: 'Backend', description: 'нужен Python' };

describe('extractSkillsCacheKey', () => {
  it('hashes model, schema version, title, and description under its own prefix', () => {
    const key = extractSkillsCacheKey('model-a', '1', vacancy);
    expect(key.startsWith('llm:extract-skills:')).toBe(true);
    expect(key.slice('llm:extract-skills:'.length)).toMatch(/^[a-f0-9]{64}$/);
    expect(extractSkillsCacheKey('model-a', '1', { ...vacancy, id: 'other' })).toBe(key);
    expect(extractSkillsCacheKey('model-b', '1', vacancy)).not.toBe(key);
    expect(extractSkillsCacheKey('model-a', '1', { ...vacancy, description: 'нужен Go' })).not.toBe(
      key,
    );
  });
});
