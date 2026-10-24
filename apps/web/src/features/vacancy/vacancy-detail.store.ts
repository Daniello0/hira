import { create } from 'zustand';

interface VacancyDetailState {
  /** Vacancy shown in the detail drawer, or null when it is closed. */
  openId: string | null;
  open: (id: string) => void;
  close: () => void;
}

/** One detail drawer for the whole shell. Chat, call, and favorites cards open it. */
export const useVacancyDetail = create<VacancyDetailState>((set) => ({
  openId: null,
  open: (openId) => set({ openId }),
  close: () => set({ openId: null }),
}));
