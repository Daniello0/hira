import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { asSql } from '../chat/typeorm-chat.sql';
import type { FactPatch, MemoryStore } from './memory.store';
import type { MemoryFact } from './memory.types';
import * as rows from './typeorm-memory.sql';

/** PostgreSQL `MemoryStore`. */
@Injectable()
export class TypeOrmMemoryStore implements MemoryStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  list(userId: string): Promise<MemoryFact[]> {
    return rows.listFacts(asSql(this.dataSource), userId);
  }

  /** @inheritdoc */
  insert(fact: MemoryFact): Promise<MemoryFact> {
    return rows.insertFact(asSql(this.dataSource), fact);
  }

  /** @inheritdoc */
  update(id: string, userId: string, patch: FactPatch): Promise<MemoryFact | null> {
    return rows.updateFact(asSql(this.dataSource), id, userId, patch);
  }

  /** @inheritdoc */
  revoke(id: string, userId: string, at: Date): Promise<boolean> {
    return rows.revokeFact(asSql(this.dataSource), id, userId, at);
  }

  /** @inheritdoc */
  revokeAll(userId: string, at: Date): Promise<number> {
    return rows.revokeAllFacts(asSql(this.dataSource), userId, at);
  }
}
