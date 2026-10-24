'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a "Confirm …" button waits before it goes back to its first label. */
export const CONFIRM_RESET_MS = 4_000;

type Timer = { current: ReturnType<typeof setTimeout> | null };

/**
 * Two-step destructive button. The first press arms it; it disarms by itself
 * after a few seconds or when focus leaves the button. `arm` and `reset` are stable.
 */
export function useConfirm(): { armed: boolean; arm: () => void; reset: () => void } {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clear(timer), []);
  const arm = useCallback(() => {
    clear(timer);
    setArmed(true);
    timer.current = setTimeout(() => setArmed(false), CONFIRM_RESET_MS);
  }, []);
  const reset = useCallback(() => {
    clear(timer);
    setArmed(false);
  }, []);
  return { armed, arm, reset };
}

function clear(timer: Timer): void {
  if (timer.current !== null) clearTimeout(timer.current);
  timer.current = null;
}
