import type { HardConstraints, SearchIntent, SkillMention } from '@hira/contracts';
import { LlmOutputError } from '../llm/llm.errors';
import type { ModelIntent } from './search-intent.schema';

/** Maps the model object onto `SearchIntent`. Skill ids stay empty for retrieval. */
export function mapSearchIntent(model: ModelIntent): SearchIntent {
  return {
    rewrittenQuery: model.rewrittenQuery,
    role: model.role,
    skills: model.skills.map(toSkill),
    seniority: model.seniority,
    hardConstraints: mapHard(model.hardConstraints),
    softConstraints: mapSoft(model.softConstraints),
    complexity: model.complexity,
    intentType: model.intentType,
  };
}

function toSkill(skill: ModelIntent['skills'][number]): SkillMention {
  return { surface: skill.surface, required: skill.required, canonicalId: null };
}

function mapHard(hard: ModelIntent['hardConstraints']): HardConstraints {
  const mapped: HardConstraints = {};
  const workFormat = statedList(hard.workFormat);
  const employment = statedList(hard.employment);
  const location = statedList(hard.location);
  if (workFormat !== null) mapped.workFormat = workFormat;
  if (employment !== null) mapped.employment = employment;
  if (location !== null) mapped.location = location;
  if (hard.salaryMin !== null) mapped.salaryMin = hard.salaryMin;
  return mapped;
}

function statedList<T>(values: T[] | null): T[] | null {
  if (values === null || values.length === 0) return null;
  return values;
}

function mapSoft(items: ModelIntent['softConstraints']): Record<string, number> {
  const mapped: Record<string, number> = {};
  for (const item of items) assignSoft(mapped, item.key, item.weight);
  return mapped;
}

function assignSoft(mapped: Record<string, number>, key: string, weight: number): void {
  if (Object.prototype.hasOwnProperty.call(mapped, key)) {
    throw new LlmOutputError(`duplicate soft constraint: ${key}`);
  }
  mapped[key] = weight;
}
