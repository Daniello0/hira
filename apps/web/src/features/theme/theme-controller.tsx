'use client';

import { useEffect } from 'react';
import { THEME_SURFACE } from '../../styles/theme-colors';
import { SYSTEM_DARK_QUERY, resolveTheme } from './theme-mode';
import { useTheme } from './theme.store';

/** Applies the chosen theme to the page and browser chrome, and follows the device in System mode. */
export function ThemeController() {
  const mode = useTheme((state) => state.mode);
  const load = useTheme((state) => state.load);
  useEffect(() => load(), [load]);
  useEffect(() => {
    const device = window.matchMedia(SYSTEM_DARK_QUERY);
    const apply = () => applyTheme(resolveTheme(mode, device.matches));
    apply();
    device.addEventListener('change', apply);
    return () => device.removeEventListener('change', apply);
  }, [mode]);
  return null;
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  // Only this code writes the tag: one from Next's `viewport` would return to its value on every navigation.
  let tag = document.querySelector<HTMLMetaElement>('meta[name=theme-color]');
  if (tag === null) {
    tag = document.createElement('meta');
    tag.name = 'theme-color';
    document.head.appendChild(tag);
  }
  tag.content = THEME_SURFACE[theme];
}
