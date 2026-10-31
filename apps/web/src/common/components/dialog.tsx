'use client';

import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { IconButton } from './icon-button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Hides the heading for dialogs whose content names itself, such as search. */
  hideTitle?: boolean;
  size?: 'md' | 'wide';
  children: ReactNode;
}

const SIZE = { md: 'w-dialog', wide: 'w-dialog-wide' } as const;

/** Centered dialog. Escape and the backdrop close it; focus stays inside and returns on close. */
export function Dialog({ open, onClose, title, hideTitle = false, size = 'md', children }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="motion-scrim fixed inset-0 z-40 bg-scrim-dialog" />
        <RadixDialog.Content aria-describedby={undefined} className={`motion-dialog scroll-thin fixed top-1/2 left-1/2 z-50 max-h-dvh max-w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-dialog bg-surface-card text-ink shadow-dialog outline-none ${SIZE[size]}`}>
          {hideTitle ? (
            <RadixDialog.Title className="sr-only">{title}</RadixDialog.Title>
          ) : (
            <div className="flex items-start justify-between gap-3 px-5 pt-4">
              <RadixDialog.Title className="py-1 text-lg font-semibold">{title}</RadixDialog.Title>
              <RadixDialog.Close asChild><IconButton label="Close" tooltip={false}><X className="size-icon" aria-hidden="true" /></IconButton></RadixDialog.Close>
            </div>
          )}
          <div className={hideTitle ? '' : 'px-5 pb-5'}>{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
