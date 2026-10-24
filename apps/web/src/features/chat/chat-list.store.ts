import type { ChatSummary } from '@hira/contracts';
import { create } from 'zustand';

interface ChatListState {
  chats: ChatSummary[];
  nextCursor: string | null;
  /** `true` once the first page has arrived, so an empty list means "no chats". */
  loaded: boolean;
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
  setChats: (chats, nextCursor) => set({ chats, nextCursor, loaded: true }),
  appendPage: (chats, nextCursor) =>
    set((state) => ({ chats: [...state.chats, ...chats.filter((chat) => !state.chats.some((item) => item.id === chat.id))], nextCursor })),
  upsert: (chat) => set((state) => ({ chats: [chat, ...state.chats.filter((item) => item.id !== chat.id)] })),
  replace: (chat) => set((state) => ({ chats: state.chats.map((item) => (item.id === chat.id ? chat : item)) })),
  remove: (chatId) => set((state) => ({ chats: state.chats.filter((item) => item.id !== chatId) })),
}));
