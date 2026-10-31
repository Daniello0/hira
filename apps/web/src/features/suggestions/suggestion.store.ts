'use client';

import type { ProfileSuggestionDto } from '@hira/contracts';
import { create } from 'zustand';
import { invalidate } from '../../common/data/data-version.store';
import { acceptSuggestion, dismissSuggestion, fetchSuggestions } from './suggestion-api';
import { SUGGESTION_REFRESH_DELAYS_MS } from './suggestions.constants';

interface SuggestionState {
  items: ProfileSuggestionDto[];
  /** Closed with Escape or the backdrop: hidden in this tab, still pending on the server. */
  deferred: string[];
  /** `true` after a resume upload: the batch modal shows instead of one-by-one offers. */
  resumeBatch: boolean;
  reload: () => Promise<void>;
  accept: (id: string) => Promise<boolean>;
  dismiss: (id: string) => Promise<boolean>;
  defer: (id: string) => void;
  setResumeBatch: (open: boolean) => void;
  clear: () => void;
}

/** Pending profile offers. Accept and dismiss remove the row locally. */
export const useSuggestions = create<SuggestionState>((set, get) => ({
  items: [],
  deferred: [],
  resumeBatch: false,
  reload: async () => {
    try {
      const items = await fetchSuggestions();
      if (items !== null) set({ items });
    } catch {
      // Offers are optional; the next turn tries again.
    }
  },
  accept: async (id) => drop(set, get, id, await safely(() => acceptSuggestion(id))),
  dismiss: async (id) => drop(set, get, id, await safely(() => dismissSuggestion(id))),
  defer: (id) => set({ deferred: [...get().deferred, id] }),
  setResumeBatch: (resumeBatch) => set({ resumeBatch }),
  clear: () => set({ items: [], deferred: [], resumeBatch: false }),
}));

/** First offer the single modal should show, or undefined. */
export function nextVisibleSuggestion(state: Pick<SuggestionState, 'items' | 'deferred'>): ProfileSuggestionDto | undefined {
  return state.items.find((item) => !state.deferred.includes(item.id));
}

/** Re-reads offers and memory a little after a finished turn, when server-side extraction has run. */
export function scheduleSuggestionRefresh(): void {
  for (const delay of SUGGESTION_REFRESH_DELAYS_MS) {
    setTimeout(() => {
      void useSuggestions.getState().reload();
      invalidate('memory');
    }, delay);
  }
}

function drop(
  set: (partial: Partial<SuggestionState>) => void,
  get: () => SuggestionState,
  id: string,
  ok: boolean,
): boolean {
  if (ok) set({ items: get().items.filter((item) => item.id !== id) });
  return ok;
}

async function safely(action: () => Promise<boolean>): Promise<boolean> {
  try {
    return await action();
  } catch {
    return false;
  }
}
