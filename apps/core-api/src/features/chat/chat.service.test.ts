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

  it('finds chats by a part of the title, in any case', async () => {
    const store = new MemoryChatStore();
    const service = new ChatService(store);
    const python = await service.create(USER);
    const qa = await service.create(USER);
    await store.updateChat(python.id, { userId: 'user-1' }, { title: 'Python jobs' });
    await store.updateChat(qa.id, { userId: 'user-1' }, { title: 'QA roles' });
    const found = await service.list(USER, undefined, 10, 'PYTH');
    expect(found.items.map((chat) => chat.id)).toEqual([python.id]);
  });

  it('does not find a chat of another user, and an empty query lists everything', async () => {
    const store = new MemoryChatStore();
    const service = new ChatService(store);
    const other: Caller = { kind: 'user', userId: 'user-2' };
    const mine = await service.create(USER);
    const theirs = await service.create(other);
    await store.updateChat(mine.id, { userId: 'user-1' }, { title: 'Python jobs' });
    await store.updateChat(theirs.id, { userId: 'user-2' }, { title: 'Python secret' });
    const found = await service.list(USER, undefined, 10, 'python');
    expect(found.items.map((chat) => chat.id)).toEqual([mine.id]);
    expect((await service.list(USER, undefined, 10, '   ')).items).toHaveLength(1);
  });

  it('rejects a cursor that is not a page position', async () => {
    const service = new ChatService(new MemoryChatStore());
    await service.create(USER);
    await expect(service.list(USER, 'not-a-cursor', 2)).rejects.toBeInstanceOf(InvalidCursorError);
  });
});
