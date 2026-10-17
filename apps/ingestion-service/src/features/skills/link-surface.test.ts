import { describe, expect, it } from 'vitest';
import { linkSurface, matchFlags, type LinkHit } from './link-surface';

function hit(patch: Partial<LinkHit> = {}): LinkHit {
  return {
    skillId: 1,
    exactName: false,
    exactAlias: false,
    trigram: 0,
    cosine: 0,
    ...patch,
  };
}

describe('matchFlags', () => {
  it('matches a trimmed canonical name and alias without case', () => {
    expect(matchFlags(' Python ', { canonicalName: 'python', aliases: [] })).toEqual({
      exactName: true,
      exactAlias: false,
    });
    expect(matchFlags('k8s', { canonicalName: 'Kubernetes', aliases: ['K8s'] })).toEqual({
      exactName: false,
      exactAlias: true,
    });
  });

  it('does not treat a blank surface or a longer alias as exact', () => {
    expect(matchFlags('  ', { canonicalName: 'python', aliases: [''] }).exactName).toBe(false);
    expect(matchFlags('python', { canonicalName: 'Java', aliases: ['python3'] }).exactAlias).toBe(
      false,
    );
  });
});

describe('linkSurface', () => {
  it('prefers the canonical name, then the alias, then trigram at 0.8', () => {
    expect(linkSurface('Python', [hit({ exactName: true, skillId: 4 })])).toEqual({
      kind: 'match',
      skillId: 4,
      step: 'exact',
    });
    expect(linkSurface('k8s', [hit({ exactAlias: true, skillId: 5, cosine: 0.99 })])).toEqual({
      kind: 'match',
      skillId: 5,
      step: 'alias',
    });
    expect(
      linkSurface('Java', [
        hit({ skillId: 2, trigram: 0.79, cosine: 0.99 }),
        hit({ skillId: 3, trigram: 0.8, cosine: 0.1 }),
      ]),
    ).toEqual({ kind: 'match', skillId: 3, step: 'trigram' });
  });

  it('uses cosine 0.85 only after trigram misses, and creates a node otherwise', () => {
    expect(linkSurface('Helm', [hit({ skillId: 8, trigram: 0.2, cosine: 0.85 })])).toEqual({
      kind: 'match',
      skillId: 8,
      step: 'vector',
    });
    expect(linkSurface('Helm', [hit({ trigram: 0.79, cosine: 0.849 })])).toEqual({
      kind: 'create',
    });
    expect(linkSurface('Helm', [hit({ cosine: Number.NaN, trigram: 0.1 })])).toEqual({
      kind: 'create',
    });
    expect(linkSurface('  ', [hit({ exactName: true })])).toEqual({ kind: 'create' });
  });

  it('breaks a trigram tie toward the smaller skill id', () => {
    expect(
      linkSurface('Go', [hit({ skillId: 9, trigram: 0.8 }), hit({ skillId: 4, trigram: 0.8 })]),
    ).toEqual({ kind: 'match', skillId: 4, step: 'trigram' });
  });
});
