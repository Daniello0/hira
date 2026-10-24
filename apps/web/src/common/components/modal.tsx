'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Dialog. Escape and the backdrop close it. */
export function Modal({ title, onClose, children }: ModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="w-full max-w-md rounded-lg border border-white/10 bg-hira-panel p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="modal-title" className="text-lg font-medium">{title}</h2>
        {children}
      </div>
    </div>
  );
}
