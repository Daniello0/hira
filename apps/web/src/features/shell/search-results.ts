import type { ChatPage, ChatSummary } from '@hira/contracts';

/** Chats found so far, and where the next page starts. */
export interface SearchHits {
  chats: ChatSummary[];
  cursor: string | null;
  moreFailed: boolean;
}

/** The next page of results. Two loads of one page still show each chat once. */
export function appendHits(current: SearchHits, page: ChatPage<ChatSummary>): SearchHits {
  const known = new Set(current.chats.map((chat) => chat.id));
  return { chats: [...current.chats, ...page.items.filter((chat) => !known.has(chat.id))], cursor: page.nextCursor, moreFailed: false };
}
