'use client';

import type { ReactNode } from 'react';
import { useId, useRef } from 'react';
import { useFocusTrap } from '../hooks/use-focus-trap';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Dialog. Escape and the backdrop close it; focus stays inside and returns on close. */
export function Modal({ title, onClose, children }: ModalProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onKeyDown = useFocusTrap(panel, true, onClose);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-white/10 bg-hira-panel p-4 outline-none"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="text-lg font-medium">{title}</h2>
        {children}
      </div>
    </div>
  );
}
