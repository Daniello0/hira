'use client';

import { unstable_ViewTransition as ViewTransition, type ReactNode } from 'react';

/** Crossfades pages on navigation. The animation itself lives in `motion.css`. */
export function PageTransition({ children }: { children: ReactNode }) {
  return <ViewTransition name="page">{children}</ViewTransition>;
}
