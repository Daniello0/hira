import { SkillAliasSource, SkillEdgeType, SkillType } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { planEscoImport, type EscoConcept } from './plan-esco';

function concept(patch: Partial<EscoConcept> = {}): EscoConcept {
  return {
    uri: 'http://esco/skill/1',
    preferredLabel: 'Python',
    altLabels: ['py'],
    skillType: SkillType.Hard,
    broaderUri: null,
    ...patch,
  };
}

describe('planEscoImport', () => {
  it('stores the English label as the canon and translations as Russian aliases', () => {
    const plan = planEscoImport(
      [
        concept({ broaderUri: 'http://esco/skill/0' }),
        concept({
          uri: 'http://esco/skill/0',
          preferredLabel: 'Programming',
          altLabels: [],
          skillType: SkillType.Domain,
        }),
      ],
      new Map([['http://esco/skill/1', 'Питон']]),
    );
    const python = plan.skills.find((skill) => skill.escoUri === 'http://esco/skill/1');
    expect(python).toMatchObject({ canonicalName: 'Python', skillType: SkillType.Hard });
    expect(python?.aliases).toEqual([
      { alias: 'py', lang: 'en', source: SkillAliasSource.Esco },
      { alias: 'Питон', lang: 'ru', source: SkillAliasSource.EscoTranslated },
    ]);
    expect(plan.edges).toEqual([
      {
        sourceUri: 'http://esco/skill/1',
        targetUri: 'http://esco/skill/0',
        edgeType: SkillEdgeType.Broader,
        weight: 1,
        evidence: 'TAXONOMY',
      },
      {
        sourceUri: 'http://esco/skill/0',
        targetUri: 'http://esco/skill/1',
        edgeType: SkillEdgeType.Narrower,
        weight: 1,
        evidence: 'TAXONOMY',
      },
    ]);
    expect(plan.occupations).toEqual([]);
  });

  it('skips a colliding label and a broader link that has no target', () => {
    const plan = planEscoImport(
      [
        concept(),
        concept({
          uri: 'http://esco/skill/2',
          preferredLabel: 'Python programming',
          altLabels: ['py'],
        }),
        concept({
          uri: 'http://esco/skill/9',
          preferredLabel: 'Python',
          altLabels: [],
        }),
        concept({
          uri: 'http://esco/skill/3',
          preferredLabel: 'Helm',
          altLabels: [],
          broaderUri: 'http://esco/missing',
        }),
      ],
      new Map([
        ['http://esco/skill/1', 'Питон'],
        ['http://esco/skill/2', 'Питон'],
      ]),
    );
    expect(plan.skills.map((skill) => skill.escoUri)).toEqual([
      'http://esco/skill/1',
      'http://esco/skill/2',
      'http://esco/skill/3',
    ]);
    expect(plan.collisions).toEqual(['http://esco/skill/9', 'py', 'Питон']);
    expect(plan.edges).toEqual([]);
  });

  it('imports nothing from an empty translation map except English aliases', () => {
    const plan = planEscoImport([concept()], null);
    expect(plan.skills[0]?.aliases.map((alias) => alias.lang)).toEqual(['en']);
  });
});
