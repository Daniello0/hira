import { create } from 'zustand';

interface ChatDraftState {
  drafts: Record<string, string>;
  draftFor: (chatId: string) => string;
  setDraft: (chatId: string, draft: string) => void;
}

/** Composer drafts for this tab. They survive route changes inside the shell. */
export const useChatDraft = create<ChatDraftState>((set, get) => ({
  drafts: {},
  draftFor: (chatId) => get().drafts[chatId] ?? '',
  setDraft: (chatId, draft) =>
    set((state) => ({
      drafts:
        draft.length === 0 ? omit(state.drafts, chatId) : { ...state.drafts, [chatId]: draft },
    })),
}));

function omit(drafts: Record<string, string>, chatId: string): Record<string, string> {
  const next = { ...drafts };
  delete next[chatId];
  return next;
}
