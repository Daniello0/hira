import type { ChatSummary } from '@hira/contracts';
import { create } from 'zustand';

interface ChatListState {
  chats: ChatSummary[];
  nextCursor: string | null;
  setChats: (chats: ChatSummary[], nextCursor: string | null) => void;
  upsert: (chat: ChatSummary) => void;
  remove: (chatId: string) => void;
}

/** Sidebar list. The server remains the source of the rows. */
export const useChatList = create<ChatListState>((set) => ({
  chats: [],
  nextCursor: null,
  setChats: (chats, nextCursor) => set({ chats, nextCursor }),
  upsert: (chat) => set((state) => ({ chats: [chat, ...state.chats.filter((item) => item.id !== chat.id)] })),
  remove: (chatId) => set((state) => ({ chats: state.chats.filter((item) => item.id !== chatId) })),
}));
