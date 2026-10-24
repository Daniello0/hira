'use client';

import type { ProfileSuggestionDto } from '@hira/contracts';
import { create } from 'zustand';
import { acceptSuggestion, dismissSuggestion, fetchSuggestions } from './suggestion-api';

interface SuggestionState {
  items: ProfileSuggestionDto[];
  reload: (token: string) => Promise<void>;
  accept: (token: string, id: string) => Promise<boolean>;
  dismiss: (token: string, id: string) => Promise<boolean>;
  clear: () => void;
}

/** Pending profile offers. Accept and dismiss remove the row locally. */
export const useSuggestions = create<SuggestionState>((set, get) => ({
  items: [],
  reload: async (token) => {
    const items = await fetchSuggestions(token);
    if (items !== null) set({ items });
  },
  accept: async (token, id) => drop(set, get, id, await acceptSuggestion(token, id)),
  dismiss: async (token, id) => drop(set, get, id, await dismissSuggestion(token, id)),
  clear: () => set({ items: [] }),
}));

function drop(
  set: (partial: Partial<SuggestionState>) => void,
  get: () => SuggestionState,
  id: string,
  ok: boolean,
): boolean {
  if (ok) set({ items: get().items.filter((item) => item.id !== id) });
  return ok;
}
