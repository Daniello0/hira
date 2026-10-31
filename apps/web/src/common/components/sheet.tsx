'use client';

import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  label: string;
  side?: 'left' | 'right';
  /** Width classes; the phone drawer and the vacancy panel differ. */
  widthClass?: string;
  children: ReactNode;
}

/** Side panel over the page. It slides in and out; Escape and the backdrop close it. */
export function Sheet({ open, onClose, label, side = 'left', widthClass = 'w-sheet', children }: SheetProps) {
  const placement = side === 'left' ? 'motion-sheet-left left-0 pl-safe-left' : 'motion-sheet-right right-0 pr-safe-right';
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="motion-scrim fixed inset-0 z-30 bg-scrim-sheet" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // Focus the panel, not its first button, so no tooltip pops up on opening.
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className={`scroll-thin fixed inset-y-0 z-40 flex max-w-full flex-col overflow-y-auto bg-surface pt-safe-top pb-safe-bottom text-ink outline-none ${placement} ${widthClass}`}
        >
          <RadixDialog.Title className="sr-only">{label}</RadixDialog.Title>
          {children}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
