import { create } from 'zustand';

interface ShellState {
  sidebarOpen: boolean;
  contextOpen: boolean;
  setSidebar: (open: boolean) => void;
  setContext: (open: boolean) => void;
}

/** Mobile drawers. Desktop columns ignore these flags. */
export const useShell = create<ShellState>((set) => ({
  sidebarOpen: false,
  contextOpen: false,
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  setContext: (contextOpen) => set({ contextOpen }),
}));
