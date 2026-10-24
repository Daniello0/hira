'use client';

import { useEffect, useState } from 'react';

/** Search-as-you-type delay shared by the skill and location pickers. */
export const SEARCH_DEBOUNCE_MS = 250;

/** `value` after it has stopped changing for `delayMs`. */
export function useDebounced<T>(value: T, delayMs: number = SEARCH_DEBOUNCE_MS): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}
