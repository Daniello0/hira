const FALLBACK_MS = 200;

/** CSS time (`200ms`, `.2s`) in milliseconds. Unreadable text is the moderate duration. */
export function parseDurationMs(value: string): number {
  const match = /^\s*([\d.]+)(ms|s)\s*$/.exec(value);
  if (match === null) return FALLBACK_MS;
  const amount = Number(match[1]);
  return match[2] === 's' ? amount * 1000 : amount;
}

/** Reads the exit time from `motion.css`, so the code never repeats it. */
export function exitDurationMs(): number {
  if (typeof document === 'undefined') return 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return 0;
  return parseDurationMs(getComputedStyle(document.documentElement).getPropertyValue('--duration-moderate'));
}
