'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { exitDurationMs } from '../utils/motion-time';

/**
 * Removal of a list row: `leave` starts the exit animation and runs `remove` when it ends.
 * Put `data-leaving={leaving}` and the `motion-row` class on the row.
 */
export function useLeaving(): { leaving: boolean; leave: (remove: () => void) => void } {
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const leave = useCallback((remove: () => void) => {
    setLeaving(true);
    timer.current = setTimeout(remove, exitDurationMs());
  }, []);
  return { leaving, leave };
}
