import type { MemoryKind } from '../../enums/memory-kind.enum';

/** Long-term memory fact shown to the account owner. Fields follow Wiki/04-data-model.md. */
export interface MemoryFactDto {
  id: string;
  kind: MemoryKind;
  content: string;
  confidence: number;
  isPinned: boolean;
  sourceMessageId: string | null;
  expiresAt: string | null;
}
