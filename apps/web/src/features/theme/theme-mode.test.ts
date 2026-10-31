import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME_MODE, ThemeMode, parseThemeMode, resolveTheme, themeBootScript } from './theme-mode';

describe('theme mode', () => {
  it('is dark when nothing was chosen', () => {
    expect(DEFAULT_THEME_MODE).toBe(ThemeMode.Dark);
    expect(parseThemeMode(null)).toBe(ThemeMode.Dark);
  });

  it('ignores an unknown stored value', () => {
    expect(parseThemeMode('sepia')).toBe(ThemeMode.Dark);
    expect(parseThemeMode('light')).toBe(ThemeMode.Light);
  });

  it('follows the device only in System', () => {
    expect(resolveTheme(ThemeMode.System, true)).toBe('dark');
    expect(resolveTheme(ThemeMode.System, false)).toBe('light');
    expect(resolveTheme(ThemeMode.Dark, false)).toBe('dark');
    expect(resolveTheme(ThemeMode.Light, true)).toBe('light');
  });

  it('boot script sets the stored theme before paint and survives blocked storage', () => {
    const run = (stored: string | null, blocked = false) => {
      const documentElement = { dataset: {} as Record<string, string> };
      const scope = {
        localStorage: { getItem: () => { if (blocked) throw new Error('blocked'); return stored; } },
        matchMedia: () => ({ matches: false }),
        document: { documentElement, querySelector: () => null },
      };
      new Function('localStorage', 'matchMedia', 'document', themeBootScript())(scope.localStorage, scope.matchMedia, scope.document);
      return documentElement.dataset.theme;
    };
    expect(run('light')).toBe('light');
    expect(run(null)).toBe('dark');
    expect(run('system')).toBe('light');
    expect(run('light', true)).toBe('dark');
  });
});
