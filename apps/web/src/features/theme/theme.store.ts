import { create } from 'zustand';
import { DEFAULT_THEME_MODE, THEME_STORAGE_KEY, ThemeMode, parseThemeMode } from './theme-mode';

interface ThemeState {
  mode: ThemeMode;
  /** Reads the saved choice once the page runs in a browser. */
  load: () => void;
  setMode: (mode: ThemeMode) => void;
}

/** The user's theme choice. Only the Appearance page changes it. */
export const useTheme = create<ThemeState>((set) => ({
  mode: DEFAULT_THEME_MODE,
  load: () => set({ mode: readStored() }),
  setMode: (mode) => {
    writeStored(mode);
    set({ mode });
  },
}));

function readStored(): ThemeMode {
  try {
    return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME_MODE;
  }
}

function writeStored(mode: ThemeMode): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Blocked storage only loses the choice after a reload.
  }
}
