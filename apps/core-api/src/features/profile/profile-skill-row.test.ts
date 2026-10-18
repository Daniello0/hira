import { describe, expect, it } from 'vitest';
import { PROFILE_SKILL_SQL, toProfileSkill } from './typeorm-profile.store';

describe('profile skill row', () => {
  it('joins the canonical name', () => {
    expect(PROFILE_SKILL_SQL).toContain('canonical_name');
    expect(PROFILE_SKILL_SQL).toContain('skills');
  });

  it('maps the name onto the skill', () => {
    const skill = toProfileSkill({
      skillId: 4,
      canonicalName: 'Python',
      level: 'CONFIDENT',
      years: null,
      source: 'SELF_REPORTED',
      confidence: 1,
    });
    expect(skill.canonicalName).toBe('Python');
  });
});
