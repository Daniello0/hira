import { SkillEdgeType, SkillImportance } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import type { ExpandedSkill } from '../graph/expand-skills';
import { explainSkills } from './explain-skills';

const names = new Map<number, string>([
  [1, 'Docker'],
  [2, 'Kubernetes'],
  [3, 'Helm'],
]);

function expanded(patch: Partial<ExpandedSkill> & Pick<ExpandedSkill, 'skillId'>): ExpandedSkill {
  return {
    weight: 1,
    hop: 0,
    parentSkillId: null,
    edgeType: null,
    trail: [],
    ...patch,
  };
}

describe('explainSkills', () => {
  it('puts a seed in matched without a path and a RELATED_TO hop in related', () => {
    const explained = explainSkills({
      vacancySkills: [
        { skillId: 1, importance: SkillImportance.Required, evidenceSpan: 'docker' },
        { skillId: 2, importance: SkillImportance.Preferred, evidenceSpan: 'кубер' },
      ],
      linked: [{ surface: 'k8s', skillId: 1, step: 'alias' }],
      expanded: [
        expanded({ skillId: 1 }),
        expanded({
          skillId: 2,
          weight: 0.6,
          hop: 1,
          parentSkillId: 1,
          edgeType: SkillEdgeType.RelatedTo,
          trail: [{ fromSkillId: 1, edgeType: SkillEdgeType.RelatedTo, toSkillId: 2 }],
        }),
      ],
      names,
      profileSkillIds: null,
    });
    expect(explained.matchedSkills).toEqual([
      { surface: 'k8s', canonicalId: '1', evidenceSpan: 'docker', path: null },
    ]);
    expect(explained.relatedSkills).toEqual([
      {
        surface: 'Kubernetes',
        canonicalId: '2',
        evidenceSpan: 'кубер',
        path: 'Docker → RELATED_TO → Kubernetes',
      },
    ]);
    expect(explained.missingSkills).toEqual([]);
  });

  it('treats an ALTERNATIVE_OF path as matched and lists required skills the profile lacks', () => {
    const explained = explainSkills({
      vacancySkills: [
        { skillId: 2, importance: SkillImportance.Required, evidenceSpan: null },
        { skillId: 3, importance: SkillImportance.Required, evidenceSpan: 'helm' },
        { skillId: 1, importance: SkillImportance.Preferred, evidenceSpan: null },
      ],
      linked: [{ surface: 'Docker', skillId: 1, step: 'exact' }],
      expanded: [
        expanded({ skillId: 1 }),
        expanded({
          skillId: 2,
          hop: 1,
          parentSkillId: 1,
          edgeType: SkillEdgeType.AlternativeOf,
          trail: [{ fromSkillId: 1, edgeType: SkillEdgeType.AlternativeOf, toSkillId: 2 }],
        }),
      ],
      names,
      profileSkillIds: new Set([2]),
    });
    expect(explained.matchedSkills.map((skill) => skill.canonicalId)).toEqual(['1', '2']);
    expect(explained.matchedSkills.find((skill) => skill.canonicalId === '2')?.path).toBe(
      'Docker → ALTERNATIVE_OF → Kubernetes',
    );
    expect(explained.relatedSkills).toEqual([]);
    expect(explained.missingSkills).toEqual([
      { surface: 'Helm', canonicalId: '3', evidenceSpan: 'helm', path: null },
    ]);
  });
});
