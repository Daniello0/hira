import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { PageCursor } from './chat-cursor';
import { DemoChatLimitError } from './chat.errors';
import type {
  ChatOwner,
  ChatPatch,
  ChatRecord,
  ChatStore,
  CompletedTurn,
  DirectSearchLog,
  MessageRecord,
  NewMessage,
  ShownVacancyRecord,
} from './chat.store';
import * as rows from './typeorm-chat.sql';
import { loadVacancyCards } from './vacancy-card';

/** PostgreSQL `ChatStore`. Cursor order matches `isBeforeCursor`. */
@Injectable()
export class TypeOrmChatStore implements ChatStore {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** @inheritdoc */
  async insertChat(owner: ChatOwner): Promise<ChatRecord> {
    try {
      return await rows.insertChat(rows.asSql(this.dataSource), owner);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DemoChatLimitError();
      throw error;
    }
  }

  /** @inheritdoc */
  findChat(id: string): Promise<ChatRecord | null> {
    return rows.findChat(rows.asSql(this.dataSource), id);
  }

  /** @inheritdoc */
  findDemoChat(demoSessionId: string): Promise<ChatRecord | null> {
    return rows.findDemoChat(rows.asSql(this.dataSource), demoSessionId);
  }

  /** @inheritdoc */
  countChats(userId: string): Promise<number> {
    return rows.countChats(rows.asSql(this.dataSource), userId);
  }

  /** @inheritdoc */
  listChats(owner: ChatOwner, cursor: PageCursor | null, limit: number): Promise<ChatRecord[]> {
    return rows.listChats(rows.asSql(this.dataSource), owner, cursor, limit);
  }

  /** @inheritdoc */
  updateChat(id: string, owner: ChatOwner, patch: ChatPatch): Promise<ChatRecord | null> {
    return rows.updateChat(rows.asSql(this.dataSource), id, owner, patch);
  }

  /** @inheritdoc */
  deleteChat(id: string, owner: ChatOwner): Promise<boolean> {
    return rows.deleteChat(rows.asSql(this.dataSource), id, owner);
  }

  /** @inheritdoc */
  insertMessage(input: NewMessage): Promise<MessageRecord> {
    return rows.insertMessage(rows.asSql(this.dataSource), input);
  }

  /** @inheritdoc */
  patchUserMessage(
    id: string,
    intent: MessageRecord['intent'],
    usage: MessageRecord['tokenUsage'],
    diagnostics?: MessageRecord['diagnostics'],
  ): Promise<void> {
    if (intent === null) return Promise.resolve();
    return rows.patchUserMessage(rows.asSql(this.dataSource), id, intent, usage, diagnostics);
  }

  /** @inheritdoc */
  recentMessages(chatId: string, limit: number): Promise<MessageRecord[]> {
    return rows.recentMessages(rows.asSql(this.dataSource), chatId, limit);
  }

  /** @inheritdoc */
  findMessage(chatId: string, id: string): Promise<MessageRecord | null> {
    return rows.findMessage(rows.asSql(this.dataSource), chatId, id);
  }

  /** @inheritdoc */
  listMessages(chatId: string, cursor: PageCursor | null, limit: number): Promise<MessageRecord[]> {
    return rows.listMessages(rows.asSql(this.dataSource), chatId, cursor, limit);
  }

  /** @inheritdoc */
  async vacanciesFor(messageIds: string[]): Promise<ShownVacancyRecord[]> {
    const sql = rows.asSql(this.dataSource);
    const snapshots = await rows.vacanciesFor(sql, messageIds);
    const cards = await loadVacancyCards(sql, snapshots.map((row) => row.vacancyId));
    return snapshots.flatMap((row) => {
      const vacancy = cards.get(row.vacancyId);
      return vacancy === undefined ? [] : [{ ...row, vacancy }];
    });
  }

  /** @inheritdoc */
  completeTurn(input: CompletedTurn): Promise<MessageRecord> {
    return this.dataSource.transaction((manager) => rows.completeTurn(manager, input));
  }

  /** @inheritdoc */
  setTitleIfEmpty(chatId: string, title: string): Promise<void> {
    return rows.setTitleIfEmpty(rows.asSql(this.dataSource), chatId, title);
  }

  /** @inheritdoc */
  insertSearchLog(input: DirectSearchLog): Promise<void> {
    return rows.insertSearchLog(rows.asSql(this.dataSource), input);
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const row = error as { code?: string; driverError?: { code?: string } };
  return row.code === '23505' || row.driverError?.code === '23505';
}
