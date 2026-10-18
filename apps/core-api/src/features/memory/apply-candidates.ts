import { MemoryKind, MemoryOperation, type MemoryCandidate } from '@hira/contracts';
import { cosineSimilarity } from './cosine';
import { GOAL_TTL_DAYS, MEMORY_CONFIDENCE_MIN, MEMORY_DUPLICATE_COSINE } from './memory.constants';
import { isPromptLive } from './select-memory';
import type { MemoryFact } from './memory.types';

export interface ApplyContext {
  now: Date;
  userId: string;
  sourceMessageId: string | null;
  sourceCallTurnId: string | null;
  nextId: () => string;
  embed: (content: string) => Promise<number[] | null>;
}

/** Applies model candidates. Low confidence, unknown targets, and near-duplicates are skipped. */
export async function applyMemoryCandidates(
  facts: readonly MemoryFact[],
  candidates: readonly MemoryCandidate[],
  context: ApplyContext,
): Promise<MemoryFact[]> {
  let current = [...facts];
  for (const candidate of candidates) current = await applyOne(current, candidate, context);
  return current;
}

async function applyOne(
  facts: MemoryFact[],
  candidate: MemoryCandidate,
  context: ApplyContext,
): Promise<MemoryFact[]> {
  if (candidate.confidence < MEMORY_CONFIDENCE_MIN) return facts;
  if (candidate.operation === MemoryOperation.Update) return updateFact(facts, candidate, context);
  if (candidate.operation === MemoryOperation.Contradicts) return contradictFact(facts, candidate, context);
  return addFact(facts, candidate, context);
}

async function updateFact(
  facts: MemoryFact[],
  candidate: MemoryCandidate,
  context: ApplyContext,
): Promise<MemoryFact[]> {
  const target = liveTarget(facts, candidate.targetMemoryId, context);
  if (target === null) return facts;
  const next = {
    ...target,
    content: candidate.content,
    kind: candidate.kind,
    confidence: candidate.confidence,
    embedding: await context.embed(candidate.content),
    expiresAt: expiry(candidate.kind, context.now),
  };
  return facts.map((fact) => (fact.id === target.id ? next : fact));
}

async function contradictFact(
  facts: MemoryFact[],
  candidate: MemoryCandidate,
  context: ApplyContext,
): Promise<MemoryFact[]> {
  const target = liveTarget(facts, candidate.targetMemoryId, context);
  if (target === null) return facts;
  const revoked = facts.map((fact) => (fact.id === target.id ? { ...fact, revokedAt: context.now } : fact));
  return addFact(revoked, { ...candidate, operation: MemoryOperation.Add }, context);
}

async function addFact(
  facts: MemoryFact[],
  candidate: MemoryCandidate,
  context: ApplyContext,
): Promise<MemoryFact[]> {
  const embedding = await context.embed(candidate.content);
  if (isDuplicate(facts, embedding, context.now)) return facts;
  return [...facts, newFact(candidate, embedding, context)];
}

function liveTarget(facts: readonly MemoryFact[], id: string | undefined, context: ApplyContext): MemoryFact | null {
  if (id === undefined) return null;
  const target = facts.find((fact) => fact.id === id && fact.userId === context.userId);
  if (target === undefined || !isPromptLive(target, context.now)) return null;
  return target;
}

function isDuplicate(facts: readonly MemoryFact[], embedding: number[] | null, now: Date): boolean {
  if (embedding === null) return false;
  return facts.some((fact) => isNearDuplicate(fact, embedding, now));
}

function isNearDuplicate(fact: MemoryFact, embedding: number[], now: Date): boolean {
  if (!isPromptLive(fact, now) || fact.embedding === null) return false;
  return cosineSimilarity(fact.embedding, embedding) > MEMORY_DUPLICATE_COSINE;
}

function newFact(candidate: MemoryCandidate, embedding: number[] | null, context: ApplyContext): MemoryFact {
  return {
    id: context.nextId(),
    userId: context.userId,
    kind: candidate.kind,
    content: candidate.content,
    embedding,
    confidence: candidate.confidence,
    sourceMessageId: context.sourceMessageId,
    sourceCallTurnId: context.sourceMessageId === null ? context.sourceCallTurnId : null,
    isPinned: false,
    expiresAt: expiry(candidate.kind, context.now),
    revokedAt: null,
    createdAt: context.now,
  };
}

function expiry(kind: MemoryKind, now: Date): Date | null {
  if (kind !== MemoryKind.Goal) return null;
  return new Date(now.getTime() + GOAL_TTL_DAYS * 24 * 60 * 60 * 1000);
}
