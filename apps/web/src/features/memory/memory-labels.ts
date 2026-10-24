import { MemoryKind } from '@hira/contracts';

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

/** Confidence as a whole percent. */
export function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
