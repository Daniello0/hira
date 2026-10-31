import type { ChatSummary } from '@hira/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { findChat, useChatList } from './chat-list.store';

const chat = (id: string, isArchived = false) => ({ id, isArchived, title: id }) as ChatSummary;

describe('chat outside the loaded pages', () => {
  beforeEach(() => useChatList.setState({ chats: [chat('listed')], nextCursor: null, loaded: true, opened: null }));

  it('is found once opened, without joining the sidebar', () => {
    expect(findChat(useChatList.getState(), 'old')).toBeUndefined();
    useChatList.getState().setOpened(chat('old'));
    expect(findChat(useChatList.getState(), 'old')?.id).toBe('old');
    expect(useChatList.getState().chats.map((item) => item.id)).toEqual(['listed']);
  });

  it('follows a restore, so an archived chat can be written to again', () => {
    useChatList.getState().setOpened(chat('old', true));
    useChatList.getState().replace(chat('old', false));
    expect(findChat(useChatList.getState(), 'old')?.isArchived).toBe(false);
  });

  it('is forgotten when deleted', () => {
    useChatList.getState().setOpened(chat('old'));
    useChatList.getState().remove('old');
    expect(findChat(useChatList.getState(), 'old')).toBeUndefined();
  });

  it('survives the list going back to its first page', () => {
    useChatList.getState().setOpened(chat('old'));
    useChatList.getState().setChats([chat('other')], null);
    expect(findChat(useChatList.getState(), 'old')?.id).toBe('old');
  });

  it('prefers the listed row', () => {
    useChatList.getState().setOpened(chat('listed', true));
    expect(findChat(useChatList.getState(), 'listed')?.isArchived).toBe(false);
  });
});
