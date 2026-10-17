import { describe, expect, it } from 'vitest';
import { joinSkillNames } from './skill-names';

describe('joinSkillNames', () => {
  it('sorts canonical names and drops duplicates and blanks', () => {
    expect(joinSkillNames(['Python', 'Kubernetes', 'Python', '  ', ' Go '])).toBe(
      'Go, Kubernetes, Python',
    );
    expect(joinSkillNames([])).toBe('');
  });
});
