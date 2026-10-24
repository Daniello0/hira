import { Inject, Injectable } from '@nestjs/common';
import type { MemoryFactDto, UpdateMemoryRequest } from '@hira/contracts';
import { MEMORY_NOT_FOUND_MESSAGE } from './memory.constants';
import { isListedFact } from './select-memory';
import { MEMORY_STORE, type MemoryStore } from './memory.store';
import type { MemoryFact } from './memory.types';

/** The fact is missing or belongs to another account. */
export class MemoryNotFoundError extends Error {
  constructor() {
    super(MEMORY_NOT_FOUND_MESSAGE);
    this.name = 'MemoryNotFoundError';
  }
}

/** Account-facing memory. Revoke keeps the row so a contradiction stays explainable. */
@Injectable()
export class MemoryService {
  constructor(@Inject(MEMORY_STORE) private readonly store: MemoryStore) {}

  /** Facts the account can still see, including expired goals. */
  async list(userId: string): Promise<MemoryFactDto[]> {
    const facts = await this.store.list(userId);
    return facts.filter(isListedFact).map(toDto);
  }

  /** Edits text or the pin. A new text is re-embedded by the caller via `replaceText`. */
  async patch(userId: string, id: string, patch: UpdateMemoryRequest, embedding: number[] | null | undefined): Promise<MemoryFactDto | null> {
    const next = await this.store.update(id, userId, {
      ...(patch.content === undefined ? {} : { content: patch.content, embedding: embedding ?? null }),
      ...(patch.isPinned === undefined ? {} : { isPinned: patch.isPinned }),
    });
    return next === null || !isListedFact(next) ? null : toDto(next);
  }

  /** Forgets one fact. */
  forget(userId: string, id: string, at: Date): Promise<boolean> {
    return this.store.revoke(id, userId, at);
  }

  /** Forgets every live fact. */
  forgetAll(userId: string, at: Date): Promise<number> {
    return this.store.revokeAll(userId, at);
  }
}

function toDto(fact: MemoryFact): MemoryFactDto {
  return {
    id: fact.id,
    kind: fact.kind,
    content: fact.content,
    confidence: fact.confidence,
    isPinned: fact.isPinned,
    sourceMessageId: fact.sourceMessageId,
    sourceCallTurnId: fact.sourceCallTurnId,
    sourceChatId: fact.sourceChatId,
    sourceCallSessionId: fact.sourceCallSessionId,
    expiresAt: fact.expiresAt?.toISOString() ?? null,
    createdAt: fact.createdAt.toISOString(),
  };
}
