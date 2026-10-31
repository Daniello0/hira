'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { exitDurationMs } from '../utils/motion-time';

/**
 * Removal of a list row: `leave` starts the exit animation and runs `remove` when it ends.
 * Put `data-leaving={leaving}` and the `motion-row` class on the row.
 */
export function useLeaving(): { leaving: boolean; leave: (remove: () => void) => void } {
  const [leaving, setLeaving] = useState(false);
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; remove: () => void } | null>(null);
  // A row can unmount mid-animation, for example when its panel closes. The change still has to apply.
  useEffect(() => () => {
    if (pending.current === null) return;
    clearTimeout(pending.current.timer);
    pending.current.remove();
  }, []);
  const leave = useCallback((remove: () => void) => {
    setLeaving(true);
    const timer = setTimeout(() => {
      pending.current = null;
      remove();
    }, exitDurationMs());
    pending.current = { timer, remove };
  }, []);
  return { leaving, leave };
}
