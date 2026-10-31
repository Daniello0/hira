import { create } from 'zustand';
import { DESKTOP_QUERY } from '../../common/hooks/use-media-query';

interface ShellState {
  /** Phone sheet with the sidebar. */
  sidebarOpen: boolean;
  /** Desktop column narrowed to the icon rail. */
  sidebarCollapsed: boolean;
  /** Context panel: a column on desktop, a sheet on a phone. */
  contextOpen: boolean;
  searchOpen: boolean;
  setSidebar: (open: boolean) => void;
  toggleCollapsed: () => void;
  setContext: (open: boolean) => void;
  setSearch: (open: boolean) => void;
  /** Reads the saved layout once the page runs in a browser. */
  load: () => void;
}

const COLLAPSED_KEY = 'hira-sidebar-collapsed';
const CONTEXT_KEY = 'hira-context-open';

/** Shell layout. Only the sidebar column and the context panel survive a reload. */
export const useShell = create<ShellState>((set, get) => ({
  sidebarOpen: false,
  sidebarCollapsed: false,
  contextOpen: false,
  searchOpen: false,
  setSidebar: (sidebarOpen) => set({ sidebarOpen }),
  toggleCollapsed: () => {
    const sidebarCollapsed = !get().sidebarCollapsed;
    remember(COLLAPSED_KEY, sidebarCollapsed);
    set({ sidebarCollapsed });
  },
  setContext: (contextOpen) => {
    if (isDesktop()) remember(CONTEXT_KEY, contextOpen);
    set({ contextOpen });
  },
  setSearch: (searchOpen) => set({ searchOpen }),
  load: () => set({ sidebarCollapsed: recall(COLLAPSED_KEY), contextOpen: isDesktop() && recall(CONTEXT_KEY) }),
}));

/** On a phone the panel is a sheet over the chat, so it never reopens by itself. */
function isDesktop(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function remember(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Blocked storage only loses the layout after a reload.
  }
}

function recall(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}
