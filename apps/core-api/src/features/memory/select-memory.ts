import { MemoryKind, type PromptMemory } from '@hira/contracts';
import { cosineSimilarity } from './cosine';
import { MEMORY_NEIGHBOR_LIMIT } from './memory.constants';
import type { MemoryFact } from './memory.types';

/** Constraints, pinned facts, then the nearest other live facts. Documents are not included. */
export function selectPromptFacts(
  facts: readonly MemoryFact[],
  query: readonly number[] | null,
  now: Date,
): PromptMemory[] {
  const live = facts.filter((fact) => isPromptLive(fact, now));
  const always = live.filter(isAlwaysIncluded);
  const nearest = nearestFacts(live, always, query);
  return mergeFacts(always, nearest).map((fact) => ({ content: fact.content }));
}

/** A fact the account can still see. Expired goals stay until the user deletes them. */
export function isListedFact(fact: MemoryFact): boolean {
  return fact.revokedAt === null;
}

/** A fact that may enter a prompt. */
export function isPromptLive(fact: MemoryFact, now: Date): boolean {
  if (fact.revokedAt !== null) return false;
  return fact.expiresAt === null || fact.expiresAt.getTime() > now.getTime();
}

function isAlwaysIncluded(fact: MemoryFact): boolean {
  return fact.kind === MemoryKind.Constraint || fact.isPinned;
}

function nearestFacts(
  live: readonly MemoryFact[],
  always: readonly MemoryFact[],
  query: readonly number[] | null,
): MemoryFact[] {
  if (query === null) return [];
  const skip = new Set(always.map((fact) => fact.id));
  return live
    .filter((fact) => !skip.has(fact.id) && fact.embedding !== null)
    .map((fact) => ({ fact, score: cosineSimilarity(fact.embedding ?? [], query) }))
    .sort(byScore)
    .slice(0, MEMORY_NEIGHBOR_LIMIT)
    .map((row) => row.fact);
}

function mergeFacts(always: readonly MemoryFact[], nearest: readonly MemoryFact[]): MemoryFact[] {
  const seen = new Set(always.map((fact) => fact.id));
  return [...always, ...nearest.filter((fact) => !seen.has(fact.id))];
}

function byScore(left: { fact: MemoryFact; score: number }, right: { fact: MemoryFact; score: number }): number {
  return right.score - left.score || left.fact.id.localeCompare(right.fact.id);
}
