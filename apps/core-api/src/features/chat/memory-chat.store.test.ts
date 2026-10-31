import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './chat-cursor';
import { MemoryChatStore } from './memory-chat.store';
import { heuristicIntent } from '../search-orchestrator/heuristic-intent';
import { retrievalResponse, vacancyResult } from '../search-orchestrator/search-fixture';

describe('memory chat store', () => {
  it('pages chats from the newest activity toward older rows', async () => {
    const store = new MemoryChatStore();
    const first = await store.insertChat({ userId: 'user-1' });
    const second = await store.insertChat({ userId: 'user-1' });
    const third = await store.insertChat({ userId: 'user-1' });
    await store.insertChat({ userId: 'user-2' });

    const page = await store.listChats({ userId: 'user-1' }, null, 2);
    expect(page.map((chat) => chat.id)).toEqual([third.id, second.id, first.id]);
    const cursor = decodeCursor(encodeCursor(page[1]?.updatedAt ?? new Date(0), page[1]?.id ?? ''));
    const rest = await store.listChats({ userId: 'user-1' }, cursor, 2);
    expect(rest.map((chat) => chat.id)).toEqual([first.id]);
  });

  it('hands a guest chat with messages to the account, once, and logs follow it', async () => {
    const store = new MemoryChatStore();
    const chat = await store.insertChat({ demoSessionId: 'guest-1' });
    const message = await store.insertMessage({ chatId: chat.id, role: MessageRole.User, content: 'hi' });
    await store.insertSearchLog({ userId: null, messageId: message.id, rawQuery: 'hi', intent: heuristicIntent('hi'), diagnostics: retrievalResponse().diagnostics });
    const claimed = await store.claimDemoChat('guest-1', 'user-1');
    expect(claimed).toMatchObject({ id: chat.id, userId: 'user-1', demoSessionId: null });
    expect(store.searchLogs[0]?.userId).toBe('user-1');
    expect(await store.claimDemoChat('guest-1', 'user-1')).toBeNull();
    expect(await store.findDemoChat('guest-1')).toBeNull();
  });

  it('does not hand over an empty guest chat', async () => {
    const store = new MemoryChatStore();
    await store.insertChat({ demoSessionId: 'guest-1' });
    expect(await store.claimDemoChat('guest-1', 'user-1')).toBeNull();
    expect(await store.findDemoChat('guest-1')).not.toBeNull();
  });

  it('keeps vacancy snapshots on the assistant message and drops them with the chat', async () => {
    const store = new MemoryChatStore();
    const chat = await store.insertChat({ userId: 'user-1' });
    const user = await store.insertMessage({ chatId: chat.id, role: MessageRole.User, content: 'python' });
    const card = vacancyResult();
    await store.completeTurn({
      userMessageId: user.id,
      chatId: chat.id,
      intent: heuristicIntent('python'),
      diagnostics: retrievalResponse().diagnostics,
      understandUsage: null,
      content: 'Here',
      generateUsage: null,
      vacancies: [
        {
          vacancyId: card.vacancy.id,
          rank: 1,
          score: card.score,
          explanation: card.explanation,
          retrievedBy: card.retrievedBy,
        },
      ],
      rawQuery: 'python',
      userId: 'user-1',
    });
    const messages = await store.listMessages(chat.id, null, 10);
    const vacancies = await store.vacanciesFor(messages.map((message) => message.id));
    expect(vacancies).toHaveLength(1);
    expect(await store.deleteChat(chat.id, { userId: 'user-1' })).toBe(true);
    expect(await store.vacanciesFor([vacancies[0]?.messageId ?? ''])).toEqual([]);
    expect(await store.deleteChat(chat.id, { userId: 'someone-else' })).toBe(false);
  });
});
