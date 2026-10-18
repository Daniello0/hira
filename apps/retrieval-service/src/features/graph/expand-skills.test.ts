import { SkillEdgeType } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { expandSkills, type GraphEdge } from './expand-skills';

function edge(
  sourceSkillId: number,
  targetSkillId: number,
  edgeType: SkillEdgeType,
  weight: number,
): GraphEdge {
  return { sourceSkillId, targetSkillId, edgeType, weight };
}

describe('expandSkills', () => {
  it('walks two hops and stops before the third', () => {
    const expanded = expandSkills(
      [1],
      [
        edge(1, 2, SkillEdgeType.AlternativeOf, 1),
        edge(2, 3, SkillEdgeType.AlternativeOf, 1),
        edge(3, 4, SkillEdgeType.AlternativeOf, 1),
      ],
    );
    expect(expanded.map((item) => item.skillId).sort((left, right) => left - right)).toEqual([
      1, 2, 3,
    ]);
    const hop2 = expanded.find((item) => item.skillId === 3);
    expect(hop2?.hop).toBe(2);
    expect(hop2?.trail).toHaveLength(2);
    expect(expanded.some((item) => item.hop > 2)).toBe(false);
  });

  it('does not grow a node whose weight is 0.25', () => {
    const expanded = expandSkills(
      [1],
      [edge(1, 2, SkillEdgeType.AlternativeOf, 0.25), edge(2, 3, SkillEdgeType.AlternativeOf, 1)],
    );
    expect(expanded.map((item) => item.skillId).sort((left, right) => left - right)).toEqual([
      1, 2,
    ]);
    expect(expanded.find((item) => item.skillId === 2)?.weight).toBeCloseTo(0.25);
  });

  it('multiplies a RELATED_TO edge by 0.6 and ignores BROADER', () => {
    const expanded = expandSkills(
      [1],
      [edge(1, 2, SkillEdgeType.RelatedTo, 0.5), edge(1, 3, SkillEdgeType.Broader, 1)],
    );
    expect(expanded.find((item) => item.skillId === 2)?.weight).toBeCloseTo(0.3);
    expect(expanded.some((item) => item.skillId === 3)).toBe(false);
  });

  it('keeps the heavier path and the 200 highest weights', () => {
    const heavier = expandSkills(
      [1],
      [edge(1, 2, SkillEdgeType.RelatedTo, 1), edge(1, 2, SkillEdgeType.Narrower, 1)],
    );
    expect(heavier.find((item) => item.skillId === 2)?.weight).toBeCloseTo(0.8);
    expect(heavier.find((item) => item.skillId === 2)?.edgeType).toBe(SkillEdgeType.Narrower);
    const edges = [
      ...Array.from({ length: 199 }, (_, index) =>
        edge(1, index + 2, SkillEdgeType.AlternativeOf, 1),
      ),
      edge(1, 201, SkillEdgeType.AlternativeOf, 0.5),
    ];
    const capped = expandSkills([1], edges);
    expect(capped).toHaveLength(200);
    expect(capped.some((item) => item.skillId === 201)).toBe(false);
  });
});
