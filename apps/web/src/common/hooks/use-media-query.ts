'use client';

import { useEffect, useState } from 'react';

/** Same width as Tailwind's `md`: from here the sidebar is a column, below it a sheet. */
export const DESKTOP_QUERY = '(min-width: 48rem)';

/** Live result of a media query. `false` until mounted, so the server render stays stable. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}
