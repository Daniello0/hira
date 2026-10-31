import { Injectable, Inject } from '@nestjs/common';
import type { ChatDetail, ChatPage, ChatSummary } from '@hira/contracts';
import { decodeCursor, type PageCursor } from './chat-cursor';
import {
  ChatNotFoundError,
  DemoChatLimitError,
  EmptyChatPatchError,
  InvalidCursorError,
} from './chat.errors';
import { cutIdPage, toChatSummary, toMessageView } from './chat.presenter';
import {
  CHAT_STORE,
  type ChatOwner,
  type ChatPatch,
  type ChatRecord,
  type ChatStore,
} from './chat.store';
import { exclusive } from './exclusive';
import { resolveCaller, type Caller, type CallerHint } from './resolve-actor';

export type { Caller, CallerHint };

/** Chat CRUD. A demo cookie owns one chat, with no user row. */
@Injectable()
export class ChatService {
  constructor(@Inject(CHAT_STORE) private readonly chats: ChatStore) {}

  /** Resolves the caller. A missing bearer and a missing demo cookie are 401. */
  caller(hint: CallerHint): Caller {
    return resolveCaller(hint);
  }

  /** Lists chats, optionally by a part of the title. A demo cookie receives its chat, created on the first call. */
  async list(
    caller: Caller,
    rawCursor: string | undefined,
    limit: number,
    rawQuery?: string,
  ): Promise<ChatPage<ChatSummary>> {
    if (caller.kind === 'demo') await this.ensureDemo(caller.demoSessionId);
    const owner = ownerOf(caller);
    const titleQuery = rawQuery?.trim() || undefined;
    const rows = await this.chats.listChats(owner, this.pageCursor(rawCursor), limit, titleQuery);
    const page = cutIdPage(
      rows.map((chat) => ({ ...chat, at: chat.updatedAt })),
      limit,
      false,
    );
    return { items: page.items.map(toChatSummary), nextCursor: page.nextCursor };
  }

  /** Creates an empty chat. A second demo chat is rejected. */
  async create(caller: Caller): Promise<ChatSummary> {
    const chat =
      caller.kind === 'demo'
        ? await this.createDemo(caller.demoSessionId)
        : await this.chats.insertChat(ownerOf(caller));
    return toChatSummary(chat);
  }

  /** Moves the guest chat behind the cookie into the signed-in account. Null when there is nothing to move. */
  async claimGuest(userId: string, demoSessionId: string | undefined): Promise<ChatSummary | null> {
    if (demoSessionId === undefined) return null;
    const chat = await this.chats.claimDemoChat(demoSessionId, userId);
    return chat === null ? null : toChatSummary(chat);
  }

  /** Chat plus the latest messages, oldest first. */
  async detail(
    caller: Caller,
    chatId: string,
    rawCursor: string | undefined,
    limit: number,
  ): Promise<ChatDetail> {
    const chat = await this.owned(caller, chatId);
    const messages = await this.messages(caller, chatId, rawCursor, limit);
    return { chat: toChatSummary(chat), messages: messages.items, nextCursor: messages.nextCursor };
  }

  /** Renames or archives a chat the caller owns. */
  async update(caller: Caller, chatId: string, patch: ChatPatch): Promise<ChatSummary> {
    if (patch.title === undefined && patch.isArchived === undefined)
      throw new EmptyChatPatchError();
    await this.owned(caller, chatId);
    const updated = await this.chats.updateChat(chatId, ownerOf(caller), patch);
    if (updated === null) throw new ChatNotFoundError();
    return toChatSummary(updated);
  }

  /** Hard-deletes a chat the caller owns. */
  async remove(caller: Caller, chatId: string): Promise<void> {
    if (!(await this.chats.deleteChat(chatId, ownerOf(caller)))) throw new ChatNotFoundError();
  }

  /** Older messages, oldest first inside the page. */
  async messages(caller: Caller, chatId: string, rawCursor: string | undefined, limit: number) {
    await this.owned(caller, chatId);
    const listed = await this.chats.listMessages(chatId, this.pageCursor(rawCursor), limit);
    const page = cutIdPage(
      listed.map((message) => ({ ...message, at: message.createdAt })),
      limit,
      true,
    );
    const vacancies = await this.chats.vacanciesFor(page.items.map((message) => message.id));
    return {
      items: page.items.map((message) => toMessageView(message, vacancies)),
      nextCursor: page.nextCursor,
    };
  }

  /** Loads a chat or throws when it belongs to someone else. */
  owned(caller: Caller, chatId: string): Promise<ChatRecord> {
    return this.requireOwned(caller, chatId);
  }

  private async requireOwned(caller: Caller, chatId: string): Promise<ChatRecord> {
    const chat = await this.chats.findChat(chatId);
    if (chat === null || !sameOwner(chat, ownerOf(caller))) throw new ChatNotFoundError();
    return chat;
  }

  private ensureDemo(sessionId: string): Promise<ChatRecord> {
    return exclusive(sessionId, () => this.demoChat(sessionId));
  }

  private async demoChat(sessionId: string): Promise<ChatRecord> {
    const existing = await this.chats.findDemoChat(sessionId);
    if (existing !== null) return existing;
    return this.chats.insertChat({ demoSessionId: sessionId });
  }

  private createDemo(sessionId: string): Promise<ChatRecord> {
    return exclusive(sessionId, () => this.insertDemo(sessionId));
  }

  private async insertDemo(sessionId: string): Promise<ChatRecord> {
    if ((await this.chats.findDemoChat(sessionId)) !== null) throw new DemoChatLimitError();
    return this.chats.insertChat({ demoSessionId: sessionId });
  }

  private pageCursor(raw: string | undefined): PageCursor | null {
    if (raw === undefined || raw.length === 0) return null;
    const cursor = decodeCursor(raw);
    if (cursor === null) throw new InvalidCursorError();
    return cursor;
  }
}

function ownerOf(caller: Caller): ChatOwner {
  if (caller.kind === 'user') return { userId: caller.userId };
  return { demoSessionId: caller.demoSessionId };
}

function sameOwner(chat: ChatRecord, owner: ChatOwner): boolean {
  if ('userId' in owner) return chat.userId === owner.userId;
  return chat.demoSessionId === owner.demoSessionId;
}
