import type { ChatSummary } from '@hira/contracts';
import { create } from 'zustand';

interface ChatListState {
  chats: ChatSummary[];
  nextCursor: string | null;
  /** `true` once the first page has arrived, so an empty list means "no chats". */
  loaded: boolean;
  /** The open chat as the server sent it. It may sit on a page the sidebar has not loaded. */
  opened: ChatSummary | null;
  setOpened: (chat: ChatSummary) => void;
  setChats: (chats: ChatSummary[], nextCursor: string | null) => void;
  appendPage: (chats: ChatSummary[], nextCursor: string | null) => void;
  upsert: (chat: ChatSummary) => void;
  replace: (chat: ChatSummary) => void;
  remove: (chatId: string) => void;
}

/** Sidebar list. The server remains the source of the rows. */
export const useChatList = create<ChatListState>((set) => ({
  chats: [],
  nextCursor: null,
  loaded: false,
  opened: null,
  setOpened: (opened) => set({ opened }),
  setChats: (chats, nextCursor) => set({ chats, nextCursor, loaded: true }),
  appendPage: (chats, nextCursor) =>
    set((state) => ({ chats: [...state.chats, ...chats.filter((chat) => !state.chats.some((item) => item.id === chat.id))], nextCursor })),
  upsert: (chat) => set((state) => ({ chats: [chat, ...state.chats.filter((item) => item.id !== chat.id)] })),
  replace: (chat) =>
    set((state) => ({
      chats: state.chats.map((item) => (item.id === chat.id ? chat : item)),
      opened: state.opened?.id === chat.id ? chat : state.opened,
    })),
  remove: (chatId) =>
    set((state) => ({
      chats: state.chats.filter((item) => item.id !== chatId),
      opened: state.opened?.id === chatId ? null : state.opened,
    })),
}));

/** A chat from the sidebar pages, or the open one when those pages do not reach it. */
export function findChat(state: Pick<ChatListState, 'chats' | 'opened'>, chatId: string): ChatSummary | undefined {
  const listed = state.chats.find((chat) => chat.id === chatId);
  if (listed !== undefined) return listed;
  return state.opened?.id === chatId ? state.opened : undefined;
}
