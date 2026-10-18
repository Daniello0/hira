import type { MemoryKind } from '@hira/contracts';

/** One stored fact. Embeddings are plain numbers until they are written as pgvector text. */
export interface MemoryFact {
  id: string;
  userId: string;
  kind: MemoryKind;
  content: string;
  embedding: number[] | null;
  confidence: number;
  sourceMessageId: string | null;
  sourceCallTurnId: string | null;
  isPinned: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}
