'use client';

import { useEffect, useRef } from 'react';

/**
 * Runs `load` when the returned ref's element scrolls into view.
 * `position` is the page it would load: a new one watches again, so a short page keeps loading.
 */
export function useLoadOnView(enabled: boolean, position: string | null, load: () => void) {
  const sentinel = useRef<HTMLDivElement>(null);
  const latest = useRef(load);
  latest.current = load;
  useEffect(() => {
    const node = sentinel.current;
    if (node === null || !enabled) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) latest.current();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, position]);
  return sentinel;
}
