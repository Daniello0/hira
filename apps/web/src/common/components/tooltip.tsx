'use client';

import { Tooltip as RadixTooltip } from 'radix-ui';
import type { ReactElement, ReactNode } from 'react';

const OPEN_DELAY_MS = 400;

/** One provider for the page, so moving between buttons opens tips at once. */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={OPEN_DELAY_MS}>{children}</RadixTooltip.Provider>;
}

/** Short hint on hover and keyboard focus. */
export function Tooltip({ label, children, side = 'bottom' }: { label: string; children: ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content side={side} sideOffset={6} className="motion-tooltip z-50 rounded-row bg-surface-control px-2 py-1 text-xs font-medium text-ink shadow-menu">
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
