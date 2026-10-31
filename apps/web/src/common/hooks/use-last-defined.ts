'use client';

import { useRef } from 'react';

/** Keeps the last real value, so an overlay still shows its content while it closes. */
export function useLastDefined<T>(value: T | null | undefined): T | null {
  const last = useRef<T | null>(null);
  if (value !== null && value !== undefined) last.current = value;
  return last.current;
}
