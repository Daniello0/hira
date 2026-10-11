export type UpsertDecision = 'insert' | 'skip' | 'update';

/** Decides the write from the stored content hash. A missing row is an insert. */
export function decideUpsert(existingHash: string | null, nextHash: string): UpsertDecision {
  if (existingHash === null) return 'insert';
  if (existingHash === nextHash) return 'skip';
  return 'update';
}
