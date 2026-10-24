import { describe, expect, it } from 'vitest';
import { SKILL_QUERY_MIN_LENGTH, SKILL_SEARCH_LIMIT, SKILL_SEARCH_SQL } from './skill.constants';
import { TRIGRAM_MATCH_THRESHOLD } from '../memory/memory.constants';

describe('skill search sql', () => {
  it('keeps the retrieval trigram cutoff and a short result list', () => {
    expect(SKILL_QUERY_MIN_LENGTH).toBe(2);
    expect(SKILL_SEARCH_SQL).toContain('similarity');
    expect(SKILL_SEARCH_SQL).toContain('skill_aliases');
    expect(SKILL_SEARCH_SQL).toContain(`LIMIT ${SKILL_SEARCH_LIMIT}`);
    expect(TRIGRAM_MATCH_THRESHOLD).toBe(0.8);
  });
});
