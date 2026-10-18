import type { MemoryFact } from './memory.types';

export const MEMORY_STORE = Symbol('MEMORY_STORE');

export interface FactPatch {
  content?: string;
  isPinned?: boolean;
  embedding?: number[] | null;
  kind?: MemoryFact['kind'];
  confidence?: number;
  expiresAt?: Date | null;
  revokedAt?: Date | null;
}

/** Long-term facts for one account. */
export interface MemoryStore {
  list(userId: string): Promise<MemoryFact[]>;
  insert(fact: MemoryFact): Promise<MemoryFact>;
  update(id: string, userId: string, patch: FactPatch): Promise<MemoryFact | null>;
  revoke(id: string, userId: string, at: Date): Promise<boolean>;
  revokeAll(userId: string, at: Date): Promise<number>;
}
