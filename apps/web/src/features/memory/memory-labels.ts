import { MemoryKind, type MemoryFactDto } from '@hira/contracts';

const KIND_LABELS: Record<MemoryKind, string> = {
  [MemoryKind.Preference]: 'Preference',
  [MemoryKind.Constraint]: 'Constraint',
  [MemoryKind.Fact]: 'Fact',
  [MemoryKind.Goal]: 'Goal',
};

/** English name of a memory kind. */
export function memoryKindLabel(kind: MemoryKind): string {
  return KIND_LABELS[kind];
}

/** Provenance the API can show. The chat id is not on the fact. */
export function memorySourceLabel(fact: MemoryFactDto): string {
  if (fact.sourceMessageId !== null) return `Chat message ${fact.sourceMessageId}`;
  if (fact.sourceCallTurnId !== null) return `Call turn ${fact.sourceCallTurnId}`;
  return 'No source recorded';
}

/** Confidence as a whole percent. */
export function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
