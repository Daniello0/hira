import { SkillImportance, SkillType, type ExtractedSkill } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import {
  processSkillVacancies,
  type PendingSkillVacancy,
  type SkillWriterDeps,
} from './process-skills';

function vacancy(id: string): PendingSkillVacancy {
  return {
    id,
    externalId: id,
    title: 'Backend',
    description: 'нужен Python и Docker',
    contentHash: 'a'.repeat(64),
  };
}

function skill(patch: Partial<ExtractedSkill> = {}): ExtractedSkill {
  return {
    surface: 'Python',
    skillType: SkillType.Hard,
    importance: SkillImportance.Required,
    evidenceSpan: 'Python',
    weight: 0.8,
    ...patch,
  };
}

describe('processSkillVacancies', () => {
  it('links an exact skill and drops a quote that is not in the description', async () => {
    const written: Array<{ id: string; evidence: string | null }> = [];
    const ensured: string[] = [];
    const result = await processSkillVacancies(
      deps({
        claim: async () => [vacancy('v1')],
        extract: async () => [skill({ evidenceSpan: 'нет в тексте' })],
        hits: async () => [
          { skillId: 4, exactName: true, exactAlias: false, trigram: 1, cosine: 1 },
        ],
        ensureSkill: async (surface) => {
          ensured.push(surface);
          return 9;
        },
        write: async (id, skills) => {
          written.push({ id, evidence: skills[0]?.evidenceSpan ?? null });
        },
      }),
    );
    expect(result).toMatchObject({ updated: 1, failed: 0, errors: [] });
    expect(ensured).toEqual([]);
    expect(written).toEqual([{ id: 'v1', evidence: null }]);
  });

  it('creates a review node when the cascade misses and still marks the vacancy written', async () => {
    const created: string[] = [];
    const result = await processSkillVacancies(
      deps({
        claim: async () => [vacancy('v1')],
        extract: async () => [
          skill({ surface: 'Helm', evidenceSpan: null, skillType: SkillType.Tool }),
        ],
        hits: async () => [
          { skillId: 1, exactName: false, exactAlias: false, trigram: 0.1, cosine: 0.2 },
        ],
        ensureSkill: async (surface) => {
          created.push(surface);
          return 11;
        },
        write: async (_id, skills) => {
          expect(skills[0]).toMatchObject({ skillId: 11, importance: SkillImportance.Required });
        },
      }),
    );
    expect(created).toEqual(['Helm']);
    expect(result.updated).toBe(1);
  });

  it('writes an empty skill list so a vacancy with no skills is not claimed again', async () => {
    let writes = 0;
    const result = await processSkillVacancies(
      deps({
        claim: async () => [vacancy('v1')],
        extract: async () => [],
        write: async (_id, skills) => {
          writes += 1;
          expect(skills).toEqual([]);
        },
      }),
    );
    expect(writes).toBe(1);
    expect(result.updated).toBe(1);
  });

  it('records one failure and still writes the next vacancy', async () => {
    let calls = 0;
    const written: string[] = [];
    const result = await processSkillVacancies(
      deps({
        claim: async () => [vacancy('a'), vacancy('b')],
        extract: async () => {
          calls += 1;
          if (calls === 1) throw new Error('model down');
          return [];
        },
        write: async (id) => {
          written.push(id);
        },
      }),
    );
    expect(written).toEqual(['b']);
    expect(result.updated).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ externalId: 'a', message: 'model down' }]);
  });

  it('counts an out-of-range weight as a failure and does not write it', async () => {
    let writes = 0;
    const result = await processSkillVacancies(
      deps({
        claim: async () => [vacancy('v1')],
        extract: async () => [skill({ weight: 1.2 })],
        write: async () => {
          writes += 1;
        },
      }),
    );
    expect(writes).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.externalId).toBe('v1');
  });

  it('does not extract when nothing is pending', async () => {
    let extracts = 0;
    const result = await processSkillVacancies(
      deps({
        claim: async () => [],
        extract: async () => {
          extracts += 1;
          return [];
        },
      }),
    );
    expect(extracts).toBe(0);
    expect(result).toEqual({ updated: 0, failed: 0, errors: [] });
  });
});

function deps(patch: Partial<SkillWriterDeps>): SkillWriterDeps {
  return {
    claim: async () => [],
    extract: async () => [],
    hits: async () => [],
    ensureSkill: async () => 1,
    write: async () => undefined,
    ...patch,
  };
}
