'use client';

import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/use-focus-trap';

interface DrawerProps {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Edge the sheet slides from. Defaults to the left. */
  side?: 'left' | 'right';
  /** `true` (default) hides the sheet on desktop, where columns replace it. */
  mobileOnly?: boolean;
  /** Tailwind width of the sheet. */
  widthClass?: string;
}

/** Side sheet. Escape and the backdrop close it; focus stays inside and returns on close. */
export function Drawer({ open, label, onClose, children, side = 'left', mobileOnly = true, widthClass = 'w-72' }: DrawerProps) {
  const panel = useRef<HTMLDivElement>(null);
  const onKeyDown = useFocusTrap(panel, open, onClose);
  if (!open) return null;
  const placement = side === 'right' ? 'ml-auto' : '';
  return (
    <div className={`fixed inset-0 z-30 flex bg-black/60 ${mobileOnly ? 'md:hidden' : ''}`} onClick={onClose}>
      <div
        ref={panel}
        className={`h-full max-w-full overflow-y-auto bg-hira-panel p-4 outline-none ${widthClass} ${placement}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
