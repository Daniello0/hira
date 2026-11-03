'use client';

import { X } from 'lucide-react';
import { Dialog as RadixDialog } from 'radix-ui';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { pressesDefaultButton } from '../utils/dialog-enter';
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
const TEXT_FIELD = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea';
/** An Enter this soon after a dialog opened was meant for what had focus before, such as the message box under a popup that opened by itself. */
const ENTER_ARMS_AFTER_MS = 400;

/**
 * Centered dialog. Escape and the backdrop close it; focus stays inside and returns on close.
 * Enter presses the default button: the first submit button of the form inside.
 */
export function Dialog({ open, onClose, title, hideTitle = false, size = 'md', children }: DialogProps) {
  const openedAt = useRef(0);
  return (
    <RadixDialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="motion-scrim fixed inset-0 z-40 bg-scrim-dialog" />
        <RadixDialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // The first text field takes the focus, as in Rename or New file; without one the dialog itself does,
            // not its close button, so Enter reaches the default button.
            event.preventDefault();
            const content = event.currentTarget as HTMLElement;
            (content.querySelector<HTMLElement>(TEXT_FIELD) ?? content).focus();
            openedAt.current = performance.now();
          }}
          onKeyDown={(event) => {
            if (performance.now() - openedAt.current >= ENTER_ARMS_AFTER_MS) submitOnEnter(event);
          }}
          onSubmitCapture={(event) => {
            // A closed dialog stays on screen while it fades out; a late Enter or click must not submit again.
            if (open) return;
            event.preventDefault();
            event.stopPropagation();
          }}
          className={`motion-dialog scroll-thin fixed top-1/2 left-1/2 z-50 max-h-dvh max-w-full -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-dialog bg-surface-card text-ink shadow-dialog outline-none ${SIZE[size]}`}
        >
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

/** Clicks the default button for an Enter that `pressesDefaultButton` gives to the dialog. A disabled one stays idle. */
function submitOnEnter(event: KeyboardEvent<HTMLDivElement>): void {
  const target = event.target as HTMLElement;
  // React also bubbles keys from portals, such as a select list or a nested dialog; those keep their Enter.
  if (!event.currentTarget.contains(target) || !pressesDefaultButton(event.nativeEvent, target)) return;
  const button = event.currentTarget.querySelector<HTMLButtonElement>('form button[type="submit"]');
  if (button === null || button.disabled) return;
  event.preventDefault();
  button.click();
}
