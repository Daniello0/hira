import type { ExtractedSkill } from '@hira/contracts';
import { linkSurface, type LinkHit } from './link-surface';
import { quoteFromDescription } from './quote-span';
import { isSkillWeight } from './skill-weight';

/** A vacancy waiting for skill extraction. */
export interface PendingSkillVacancy {
  id: string;
  externalId: string;
  title: string;
  description: string;
  contentHash: string;
}

/** A skill row ready to insert into `vacancy_skills`. */
export interface LinkedVacancySkill {
  skillId: number;
  importance: ExtractedSkill['importance'];
  weight: number;
  evidenceSpan: string | null;
}

export interface SkillRunCounts {
  updated: number;
  failed: number;
  errors: Array<{ externalId?: string; message: string }>;
  /** Set when the tick stopped early (daily budget spent, LLM rate limit). */
  halted?: string;
}

/** Thrown by `extract` to end the whole tick: the vacancy is not at fault and is not counted. */
export class ExtractionHalted extends Error {}

export interface SkillWriterDeps {
  claim(): Promise<PendingSkillVacancy[]>;
  extract(vacancy: PendingSkillVacancy): Promise<ExtractedSkill[]>;
  hits(surface: string): Promise<LinkHit[]>;
  ensureSkill(surface: string, skill: ExtractedSkill): Promise<number>;
  write(vacancyId: string, skills: LinkedVacancySkill[]): Promise<void>;
  /** Records a failed extraction so a vacancy that keeps failing stops being claimed. */
  markFailed?(vacancy: PendingSkillVacancy): Promise<void>;
}

/** Extracts, links, and writes one claimed batch. One failure does not cancel the rest. */
export async function processSkillVacancies(deps: SkillWriterDeps): Promise<SkillRunCounts> {
  const counts: SkillRunCounts = { updated: 0, failed: 0, errors: [] };
  for (const vacancy of await deps.claim()) {
    try {
      await writeVacancy(deps, vacancy, counts);
    } catch (error) {
      if (!(error instanceof ExtractionHalted)) throw error;
      counts.halted = error.message;
      counts.errors.push({ message: error.message });
      break;
    }
  }
  return counts;
}

async function writeVacancy(
  deps: SkillWriterDeps,
  vacancy: PendingSkillVacancy,
  counts: SkillRunCounts,
): Promise<void> {
  try {
    await deps.write(vacancy.id, await linkAll(deps, vacancy));
    counts.updated += 1;
  } catch (error) {
    if (error instanceof ExtractionHalted) throw error;
    counts.failed += 1;
    counts.errors.push({ externalId: vacancy.externalId, message: errorText(error) });
    await deps.markFailed?.(vacancy);
  }
}

async function linkAll(
  deps: SkillWriterDeps,
  vacancy: PendingSkillVacancy,
): Promise<LinkedVacancySkill[]> {
  const extracted = await deps.extract(vacancy);
  if (!extracted.every((skill) => isSkillWeight(skill.weight))) {
    throw new Error('skill weight is outside 0..1');
  }
  const linked: LinkedVacancySkill[] = [];
  for (const skill of extracted) linked.push(await linkOne(deps, vacancy.description, skill));
  return linked;
}

async function linkOne(
  deps: SkillWriterDeps,
  description: string,
  skill: ExtractedSkill,
): Promise<LinkedVacancySkill> {
  const decision = linkSurface(skill.surface, await deps.hits(skill.surface));
  const skillId =
    decision.kind === 'match' ? decision.skillId : await deps.ensureSkill(skill.surface, skill);
  return {
    skillId,
    importance: skill.importance,
    weight: skill.weight,
    evidenceSpan: quoteFromDescription(description, skill.evidenceSpan),
  };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'skill extraction failed';
}
