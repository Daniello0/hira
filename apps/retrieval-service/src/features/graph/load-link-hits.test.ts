import type { SkillMention } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { resolveQuerySkills, type LinkDeps } from './load-link-hits';
import type { LinkHit } from './link-query-skill';

function mention(surface: string, canonicalId: string | null = null): SkillMention {
  return { surface, canonicalId, required: true };
}

describe('resolveQuerySkills', () => {
  it('skips a blank surface, trusts an existing id, and embeds only trigram misses', async () => {
    const embedded: string[][] = [];
    const asked: string[] = [];
    const deps: LinkDeps = {
      knownIds: async () => new Set([4]),
      hits: async (surface, vector) => {
        asked.push(`${surface}:${vector === null ? 'plain' : 'vector'}`);
        return hitsFor(surface, vector);
      },
      embed: async (texts) => {
        embedded.push([...texts]);
        return texts.map(() => [0.1]);
      },
    };
    const linked = await resolveQuerySkills(
      [mention('  '), mention('Python', '4'), mention('Helm'), mention('Java')],
      deps,
    );
    expect(linked).toEqual([
      { surface: 'Python', skillId: 4, step: 'id' },
      { surface: 'Helm', skillId: 8, step: 'vector' },
      { surface: 'Java', skillId: 3, step: 'trigram' },
    ]);
    expect(embedded).toEqual([['Helm']]);
    expect(asked.filter((call) => call.startsWith('Python'))).toEqual([]);
    expect(asked.filter((call) => call.endsWith('vector'))).toEqual(['Helm:vector']);
  });
});

function hitsFor(surface: string, vector: string | null): LinkHit[] {
  if (surface === 'Java') return [{ skillId: 3, exactName: false, exactAlias: false, trigram: 0.8, cosine: 0 }];
  if (surface === 'Helm' && vector !== null) {
    return [{ skillId: 8, exactName: false, exactAlias: false, trigram: 0.2, cosine: 0.85 }];
  }
  return [{ skillId: 8, exactName: false, exactAlias: false, trigram: 0.2, cosine: 0 }];
}
