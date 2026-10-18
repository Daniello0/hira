import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { ChatService } from './chat.service';
import { InvalidCursorError } from './chat.errors';
import { MemoryChatStore } from './memory-chat.store';
import type { Caller } from './resolve-actor';

const USER: Caller = { kind: 'user', userId: 'user-1' };

describe('chat pages', () => {
  it('does not repeat chats when the boundary chat is updated', async () => {
    const store = new MemoryChatStore();
    const service = new ChatService(store);
    const created = [
      await service.create(USER),
      await service.create(USER),
      await service.create(USER),
    ];
    const first = await service.list(USER, undefined, 2);
    expect(first.items.map((chat) => chat.id)).toEqual([created[2]?.id, created[1]?.id]);
    await store.insertMessage({
      chatId: created[1]?.id ?? '',
      role: MessageRole.User,
      content: 'bump',
    });
    const second = await service.list(USER, first.nextCursor ?? undefined, 2);
    expect(second.items.map((chat) => chat.id)).toEqual([created[0]?.id]);
  });

  it('rejects a cursor that is not a page position', async () => {
    const service = new ChatService(new MemoryChatStore());
    await service.create(USER);
    await expect(service.list(USER, 'not-a-cursor', 2)).rejects.toBeInstanceOf(InvalidCursorError);
  });
});
