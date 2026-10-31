/** Page color for browser chrome and the PWA manifest. They cannot read CSS variables, so `tokens.css` is mirrored here and a test keeps both equal. */
export const THEME_SURFACE = {
  dark: '#000000',
  light: '#fcfcfc',
} as const;
