import type { ComponentType, ReactNode } from 'react';

declare module 'react' {
  /** Available because `experimental.viewTransition` is on in `next.config.ts`. */
  export const unstable_ViewTransition: ComponentType<{ name?: string; children: ReactNode }>;
}
