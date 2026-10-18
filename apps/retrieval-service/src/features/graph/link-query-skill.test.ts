import { describe, expect, it } from 'vitest';
import { linkMention, linkQuerySkill, seedIds, type LinkHit } from './link-query-skill';

function hit(patch: Partial<LinkHit> = {}): LinkHit {
  return { skillId: 1, exactName: false, exactAlias: false, trigram: 0, cosine: 0, ...patch };
}

describe('linkQuerySkill', () => {
  it('prefers the canonical name, then the alias, then trigram at 0.8', () => {
    expect(linkQuerySkill('Python', [hit({ exactName: true, skillId: 4 })])).toEqual({
      surface: 'Python',
      skillId: 4,
      step: 'exact',
    });
    expect(linkQuerySkill('k8s', [hit({ exactAlias: true, skillId: 5, cosine: 0.99 })])).toEqual({
      surface: 'k8s',
      skillId: 5,
      step: 'alias',
    });
    expect(
      linkQuerySkill('Java', [
        hit({ skillId: 2, trigram: 0.79, cosine: 0.99 }),
        hit({ skillId: 3, trigram: 0.8, cosine: 0.1 }),
      ]),
    ).toEqual({ surface: 'Java', skillId: 3, step: 'trigram' });
  });

  it('uses cosine 0.85 after a trigram miss and does not create a node', () => {
    expect(linkQuerySkill('Helm', [hit({ skillId: 8, trigram: 0.2, cosine: 0.85 })])).toEqual({
      surface: 'Helm',
      skillId: 8,
      step: 'vector',
    });
    expect(linkQuerySkill('Helm', [hit({ trigram: 0.79, cosine: 0.849 })])).toBeNull();
    expect(linkQuerySkill('Helm', [hit({ cosine: Number.NaN, trigram: 0.1 })])).toBeNull();
    expect(linkQuerySkill('  ', [hit({ exactName: true })])).toBeNull();
  });
});

describe('linkMention', () => {
  it('takes an existing decimal canonical id and skips the cascade', () => {
    const mention = { surface: 'Python', canonicalId: '4' };
    expect(linkMention(mention, new Set([4]), [hit({ exactName: true, skillId: 9 })])).toEqual({
      surface: 'Python',
      skillId: 4,
      step: 'id',
    });
  });

  it('falls through when the id is missing or not a decimal, and skips a blank surface', () => {
    const hits = [hit({ exactName: true, skillId: 4 })];
    expect(linkMention({ surface: 'Python', canonicalId: '99' }, new Set([4]), hits)?.skillId).toBe(4);
    expect(linkMention({ surface: 'Python', canonicalId: '04' }, new Set([4]), hits)?.step).toBe('exact');
    expect(linkMention({ surface: '  ', canonicalId: '4' }, new Set([4]), hits)).toBeNull();
  });
});

describe('seedIds', () => {
  it('keeps one id when two mentions resolve to it', () => {
    expect(
      seedIds([
        { surface: 'Python', skillId: 4, step: 'id' },
        { surface: 'питон', skillId: 4, step: 'alias' },
        { surface: 'Docker', skillId: 8, step: 'exact' },
      ]),
    ).toEqual([4, 8]);
  });
});
