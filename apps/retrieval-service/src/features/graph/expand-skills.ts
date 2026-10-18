import type { SkillEdgeType } from '@hira/contracts';

/** One directed edge the walk may follow. */
export interface GraphEdge {
  sourceSkillId: number;
  targetSkillId: number;
  edgeType: SkillEdgeType;
  weight: number;
}

/** One step of the winning path. */
export interface TrailStep {
  fromSkillId: number;
  edgeType: SkillEdgeType;
  toSkillId: number;
}

/** A skill kept after the walk. `trail` is the path that produced the max weight. */
export interface ExpandedSkill {
  skillId: number;
  weight: number;
  hop: number;
  parentSkillId: number | null;
  edgeType: SkillEdgeType | null;
  trail: readonly TrailStep[];
}

/**
 * Expands seeds at most two hops.
 * The body is a stub until the red tests are in place.
 */
export function expandSkills(_seedIds: readonly number[], _edges: readonly GraphEdge[]): ExpandedSkill[] {
  return [];
}
