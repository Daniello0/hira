import { THEME_SURFACE } from '../../styles/theme-colors';

/** What the user chose on the Appearance page. */
export enum ThemeMode {
  System = 'system',
  Light = 'light',
  Dark = 'dark',
}

/** The theme a page actually renders. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'hira-theme';
export const DEFAULT_THEME_MODE = ThemeMode.Dark;
export const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';

/** Stored text as a mode. Anything unknown is the default. */
export function parseThemeMode(raw: string | null): ThemeMode {
  return raw === ThemeMode.System || raw === ThemeMode.Light || raw === ThemeMode.Dark ? raw : DEFAULT_THEME_MODE;
}

/** The theme for a mode. `System` follows the device. */
export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  if (mode === ThemeMode.System) return systemDark ? 'dark' : 'light';
  return mode === ThemeMode.Light ? 'light' : 'dark';
}

/** Runs before the first paint, so a light page never flashes dark. Failing storage leaves the default. */
export function themeBootScript(): string {
  return `(function(){var m='${DEFAULT_THEME_MODE}';try{m=localStorage.getItem('${THEME_STORAGE_KEY}')||m}catch(e){}var d=m==='${ThemeMode.System}'?matchMedia('${SYSTEM_DARK_QUERY}').matches:m!=='${ThemeMode.Light}';var t=d?'dark':'light';document.documentElement.dataset.theme=t;var c=document.querySelector('meta[name=theme-color]');if(c)c.content=d?'${THEME_SURFACE.dark}':'${THEME_SURFACE.light}'})()`;
}
