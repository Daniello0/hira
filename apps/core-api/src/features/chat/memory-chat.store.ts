import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MessageRole } from '@hira/contracts';
import { ACTIVITY_QUERIES, ACTIVITY_VACANCIES, promptVacancy, type ActivityRecord } from '../memory/account-activity';
import { DemoChatLimitError } from './chat.errors';
import { isBeforeCursor, type PageCursor } from './chat-cursor';
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

/** Process-local dialogue store. HTTP tests use it in place of PostgreSQL. */
@Injectable()
export class MemoryChatStore implements ChatStore {
  readonly chats: ChatRecord[] = [];
  readonly messages: MessageRecord[] = [];
  readonly vacancies: ShownVacancyRecord[] = [];
  readonly searchLogs: DirectSearchLog[] = [];
  private tick = 0;

  /** @inheritdoc */
  async insertChat(owner: ChatOwner): Promise<ChatRecord> {
    if ('demoSessionId' in owner && (await this.findDemoChat(owner.demoSessionId)) !== null) {
      throw new DemoChatLimitError();
    }
    const at = this.stamp();
    const chat = emptyChat(owner, at);
    this.chats.push(chat);
    return chat;
  }

  /** @inheritdoc */
  async findChat(id: string): Promise<ChatRecord | null> {
    return this.chats.find((chat) => chat.id === id) ?? null;
  }

  /** @inheritdoc */
  async findDemoChat(demoSessionId: string): Promise<ChatRecord | null> {
    return this.chats.find((chat) => chat.demoSessionId === demoSessionId) ?? null;
  }

  /** @inheritdoc */
  async recentActivity(userId: string, limit: number, exceptChatId: string | null): Promise<ActivityRecord[]> {
    const chats = this.chats
      .filter((chat) => chat.userId === userId && chat.messageCount > 0 && chat.id !== exceptChatId)
      .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
      .slice(0, limit);
    return chats.map((chat) => this.activityOf(chat));
  }

  /** @inheritdoc */
  async claimDemoChat(demoSessionId: string, userId: string): Promise<ChatRecord | null> {
    const chat = this.chats.find((row) => row.demoSessionId === demoSessionId && row.messageCount > 0);
    if (chat === undefined) return null;
    chat.userId = userId;
    chat.demoSessionId = null;
    const messageIds = new Set(this.messages.filter((message) => message.chatId === chat.id).map((message) => message.id));
    for (const log of this.searchLogs) if (log.messageId !== null && messageIds.has(log.messageId)) log.userId = userId;
    return chat;
  }

  /** @inheritdoc */
  async listChats(owner: ChatOwner, cursor: PageCursor | null, limit: number, titleQuery?: string): Promise<ChatRecord[]> {
    const needle = titleQuery?.toLowerCase();
    return this.chats
      .filter((chat) => owns(chat, owner) && this.before(chat.updatedAt, chat.id, cursor))
      .filter((chat) => needle === undefined || (chat.title ?? '').toLowerCase().includes(needle))
      .sort(byNewest)
      .slice(0, limit + 1);
  }

  /** @inheritdoc */
  async updateChat(id: string, owner: ChatOwner, patch: ChatPatch): Promise<ChatRecord | null> {
    const chat = this.chats.find((item) => item.id === id && owns(item, owner));
    if (chat === undefined) return null;
    if (patch.title !== undefined) chat.title = patch.title;
    if (patch.isArchived !== undefined) chat.isArchived = patch.isArchived;
    chat.updatedAt = this.stamp();
    return chat;
  }

  /** @inheritdoc */
  async deleteChat(id: string, owner: ChatOwner): Promise<boolean> {
    const index = this.chats.findIndex((chat) => chat.id === id && owns(chat, owner));
    if (index < 0) return false;
    const removed = this.chats.splice(index, 1)[0];
    if (removed === undefined) return false;
    this.dropChat(removed.id);
    return true;
  }

  /** @inheritdoc */
  async insertMessage(input: NewMessage): Promise<MessageRecord> {
    const message = this.message(input, null, null, null);
    this.bump(input.chatId);
    return message;
  }

  /** @inheritdoc */
  async patchUserMessage(
    id: string,
    intent: MessageRecord['intent'],
    tokenUsage: MessageRecord['tokenUsage'],
    diagnostics?: MessageRecord['diagnostics'],
  ): Promise<void> {
    const message = this.messages.find((item) => item.id === id);
    if (message === undefined || intent === null) return;
    message.intent = intent;
    message.tokenUsage = tokenUsage;
    if (diagnostics !== undefined) message.diagnostics = diagnostics;
  }

  /** @inheritdoc */
  async findMessage(chatId: string, id: string): Promise<MessageRecord | null> {
    return this.messages.find((message) => message.chatId === chatId && message.id === id) ?? null;
  }

  /** @inheritdoc */
  async recentMessages(chatId: string, limit: number): Promise<MessageRecord[]> {
    return this.messages
      .filter((message) => message.chatId === chatId)
      .sort(byOldest)
      .slice(-limit);
  }

  /** @inheritdoc */
  async listMessages(chatId: string, cursor: PageCursor | null, limit: number): Promise<MessageRecord[]> {
    return this.messages
      .filter((message) => message.chatId === chatId && this.before(message.createdAt, message.id, cursor))
      .sort(byNewestMessage)
      .slice(0, limit + 1);
  }

  /** @inheritdoc */
  async vacanciesFor(messageIds: string[]): Promise<ShownVacancyRecord[]> {
    const ids = new Set(messageIds);
    return this.vacancies.filter((row) => ids.has(row.messageId)).sort((left, right) => left.rank - right.rank);
  }

  /** @inheritdoc */
  async completeTurn(input: CompletedTurn): Promise<MessageRecord> {
    await this.patchUserMessage(input.userMessageId, input.intent, input.understandUsage, input.diagnostics);
    const assistant = this.message(
      { chatId: input.chatId, role: MessageRole.Assistant, content: input.content },
      null,
      null,
      input.generateUsage,
    );
    for (const vacancy of input.vacancies) this.vacancies.push({ ...vacancy, messageId: assistant.id });
    this.bump(input.chatId);
    return assistant;
  }

  /** @inheritdoc */
  async setSummary(chatId: string, summary: string): Promise<void> {
    const chat = this.chats.find((item) => item.id === chatId);
    if (chat === undefined) return;
    chat.summary = summary;
  }

  /** @inheritdoc */
  async chronologicalMessages(chatId: string): Promise<MessageRecord[]> {
    return this.messages.filter((message) => message.chatId === chatId).sort(byOldest);
  }

  /** @inheritdoc */
  async setTitleIfEmpty(chatId: string, title: string): Promise<void> {
    const chat = this.chats.find((item) => item.id === chatId);
    if (chat === undefined || chat.title !== null) return;
    chat.title = title;
  }

  /** @inheritdoc */
  async insertSearchLog(input: DirectSearchLog): Promise<void> {
    this.searchLogs.push(input);
  }

  private message(
    input: NewMessage,
    intent: MessageRecord['intent'],
    diagnostics: MessageRecord['diagnostics'],
    tokenUsage: MessageRecord['tokenUsage'],
  ): MessageRecord {
    const message: MessageRecord = {
      id: randomUUID(),
      chatId: input.chatId,
      role: input.role,
      content: input.content,
      intent,
      diagnostics,
      tokenUsage,
      createdAt: this.stamp(),
      useMemory: input.useMemory !== false,
    };
    this.messages.push(message);
    return message;
  }

  private bump(chatId: string): void {
    const chat = this.chats.find((item) => item.id === chatId);
    if (chat === undefined) return;
    chat.messageCount += 1;
    chat.updatedAt = this.stamp();
  }

  private dropChat(chatId: string): void {
    const ids = new Set(this.messages.filter((message) => message.chatId === chatId).map((message) => message.id));
    this.messages.splice(0, this.messages.length, ...this.messages.filter((message) => message.chatId !== chatId));
    this.vacancies.splice(0, this.vacancies.length, ...this.vacancies.filter((row) => !ids.has(row.messageId)));
  }

  private before(at: Date, id: string, cursor: PageCursor | null): boolean {
    if (cursor === null) return true;
    return isBeforeCursor({ at, id }, cursor);
  }

  private activityOf(chat: ChatRecord): ActivityRecord {
    const messages = this.messages.filter((message) => message.chatId === chat.id).reverse();
    const ids = new Set(messages.map((message) => message.id));
    return {
      kind: 'chat',
      title: chat.title,
      summary: chat.summary,
      at: chat.updatedAt,
      queries: messages.filter((message) => message.role === MessageRole.User).slice(0, ACTIVITY_QUERIES).map((message) => message.content),
      vacancies: this.vacancies
        .filter((row) => ids.has(row.messageId))
        .flatMap((row) => (row.vacancy === undefined ? [] : [promptVacancy(row.vacancy)]))
        .slice(0, ACTIVITY_VACANCIES),
    };
  }

  private stamp(): Date {
    this.tick += 1;
    return new Date(Date.UTC(2026, 9, 18, 0, 0, this.tick));
  }
}

function emptyChat(owner: ChatOwner, at: Date): ChatRecord {
  return {
    id: randomUUID(),
    userId: 'userId' in owner ? owner.userId : null,
    demoSessionId: 'demoSessionId' in owner ? owner.demoSessionId : null,
    title: null,
    summary: null,
    messageCount: 0,
    isArchived: false,
    createdAt: at,
    updatedAt: at,
  };
}

function owns(chat: ChatRecord, owner: ChatOwner): boolean {
  if ('userId' in owner) return chat.userId === owner.userId;
  return chat.demoSessionId === owner.demoSessionId;
}

function byNewest(left: ChatRecord, right: ChatRecord): number {
  return right.updatedAt.getTime() - left.updatedAt.getTime() || right.id.localeCompare(left.id);
}

function byNewestMessage(left: MessageRecord, right: MessageRecord): number {
  return right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id);
}

function byOldest(left: MessageRecord, right: MessageRecord): number {
  return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
}
