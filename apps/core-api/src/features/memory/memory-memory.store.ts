import { Injectable } from '@nestjs/common';
import type { FactPatch, MemoryStore } from './memory.store';
import type { MemoryFact } from './memory.types';

/** Process-local facts. HTTP tests use this instead of PostgreSQL. */
@Injectable()
export class MemoryMemoryStore implements MemoryStore {
  readonly facts: MemoryFact[] = [];

  /** @inheritdoc */
  async list(userId: string): Promise<MemoryFact[]> {
    return this.facts.filter((fact) => fact.userId === userId).map((fact) => ({ ...fact }));
  }

  /** @inheritdoc */
  async insert(fact: MemoryFact): Promise<MemoryFact> {
    this.facts.push({ ...fact });
    return { ...fact };
  }

  /** @inheritdoc */
  async update(id: string, userId: string, patch: FactPatch): Promise<MemoryFact | null> {
    const fact = this.owned(id, userId);
    if (fact === null) return null;
    Object.assign(fact, patch);
    return { ...fact };
  }

  /** @inheritdoc */
  async revoke(id: string, userId: string, at: Date): Promise<boolean> {
    const fact = this.owned(id, userId);
    if (fact === null || fact.revokedAt !== null) return false;
    fact.revokedAt = at;
    return true;
  }

  /** @inheritdoc */
  async revokeAll(userId: string, at: Date): Promise<number> {
    const live = this.facts.filter((fact) => fact.userId === userId && fact.revokedAt === null);
    for (const fact of live) fact.revokedAt = at;
    return live.length;
  }

  private owned(id: string, userId: string): MemoryFact | null {
    return this.facts.find((fact) => fact.id === id && fact.userId === userId) ?? null;
  }
}
