import { SkillEdgeType } from '@hira/contracts';
import {
  EDGE_DECAY,
  GRAPH_MAX_HOP,
  GRAPH_NODE_CAP,
  GRAPH_WEIGHT_FLOOR,
  SEED_WEIGHT,
} from '../search/search.constants';

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

/** Expands seeds at most two hops, then keeps the 200 heaviest nodes. */
export function expandSkills(
  seedIds: readonly number[],
  edges: readonly GraphEdge[],
): ExpandedSkill[] {
  const seeds = uniqueIds(seedIds).map(seedRow);
  const seen = walk(seeds, edges);
  return cap(bestRows(seen));
}

function walk(seeds: readonly ExpandedSkill[], edges: readonly GraphEdge[]): ExpandedSkill[] {
  let layer = [...seeds];
  const seen = [...seeds];
  for (let hop = 0; hop < GRAPH_MAX_HOP && layer.length > 0; hop += 1) {
    layer = childrenOf(layer, edges);
    seen.push(...layer);
  }
  return seen;
}

function childrenOf(layer: readonly ExpandedSkill[], edges: readonly GraphEdge[]): ExpandedSkill[] {
  const next: ExpandedSkill[] = [];
  for (const node of layer) grow(node, edges, next);
  return next;
}

function grow(node: ExpandedSkill, edges: readonly GraphEdge[], next: ExpandedSkill[]): void {
  if (node.weight <= GRAPH_WEIGHT_FLOOR) return;
  for (const edge of edges) {
    const decay = edge.sourceSkillId === node.skillId ? decayOf(edge.edgeType) : null;
    if (decay !== null) next.push(childRow(node, edge, decay));
  }
}

function childRow(node: ExpandedSkill, edge: GraphEdge, decay: number): ExpandedSkill {
  const step = {
    fromSkillId: node.skillId,
    edgeType: edge.edgeType,
    toSkillId: edge.targetSkillId,
  };
  return {
    skillId: edge.targetSkillId,
    weight: node.weight * edge.weight * decay,
    hop: node.hop + 1,
    parentSkillId: node.skillId,
    edgeType: edge.edgeType,
    trail: [...node.trail, step],
  };
}

function bestRows(rows: readonly ExpandedSkill[]): ExpandedSkill[] {
  const best = new Map<number, ExpandedSkill>();
  for (const row of rows) keepBetter(best, row);
  return [...best.values()];
}

function keepBetter(best: Map<number, ExpandedSkill>, row: ExpandedSkill): void {
  const current = best.get(row.skillId);
  if (current === undefined || better(row, current)) best.set(row.skillId, row);
}

function better(next: ExpandedSkill, current: ExpandedSkill): boolean {
  if (next.weight !== current.weight) return next.weight > current.weight;
  if (next.hop !== current.hop) return next.hop < current.hop;
  return (next.parentSkillId ?? 0) < (current.parentSkillId ?? 0);
}

function cap(rows: readonly ExpandedSkill[]): ExpandedSkill[] {
  return [...rows].sort(byWeightThenId).slice(0, GRAPH_NODE_CAP);
}

function byWeightThenId(left: ExpandedSkill, right: ExpandedSkill): number {
  return right.weight - left.weight || left.skillId - right.skillId;
}

function decayOf(edgeType: SkillEdgeType): number | null {
  if (edgeType === SkillEdgeType.AlternativeOf) return EDGE_DECAY[SkillEdgeType.AlternativeOf];
  if (edgeType === SkillEdgeType.Narrower) return EDGE_DECAY[SkillEdgeType.Narrower];
  if (edgeType === SkillEdgeType.RelatedTo) return EDGE_DECAY[SkillEdgeType.RelatedTo];
  return null;
}

function seedRow(skillId: number): ExpandedSkill {
  return { skillId, weight: SEED_WEIGHT, hop: 0, parentSkillId: null, edgeType: null, trail: [] };
}

function uniqueIds(ids: readonly number[]): number[] {
  const unique: number[] = [];
  for (const id of ids) if (!unique.includes(id)) unique.push(id);
  return unique;
}
