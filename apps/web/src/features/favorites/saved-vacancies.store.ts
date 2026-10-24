import type { FavoriteDto } from '@hira/contracts';
import { create } from 'zustand';

interface SavedVacancyState {
  byVacancy: Record<string, string>;
  setAll: (rows: readonly FavoriteDto[]) => void;
  remember: (row: FavoriteDto) => void;
  forgetVacancy: (vacancyId: string) => void;
  clear: () => void;
}

/** Favorite ids for the Save button. The list page and the chat card share it. */
export const useSavedVacancies = create<SavedVacancyState>((set) => ({
  byVacancy: {},
  setAll: (rows) => set({ byVacancy: Object.fromEntries(rows.map((row) => [row.vacancyId, row.id])) }),
  remember: (row) => set((state) => ({ byVacancy: { ...state.byVacancy, [row.vacancyId]: row.id } })),
  forgetVacancy: (vacancyId) => set((state) => ({ byVacancy: without(state.byVacancy, vacancyId) })),
  clear: () => set({ byVacancy: {} }),
}));

function without(map: Record<string, string>, vacancyId: string): Record<string, string> {
  const next = { ...map };
  delete next[vacancyId];
  return next;
}
