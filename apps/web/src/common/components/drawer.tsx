import type { ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  label: string;
  onClose: () => void;
  children: ReactNode;
}

/** Mobile sheet. Desktop columns do not use it. */
export function Drawer({ open, label, onClose, children }: DrawerProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose}>
      <div className="h-full w-72 overflow-y-auto bg-hira-panel p-4" role="dialog" aria-label={label} onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
