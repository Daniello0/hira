import type { HTMLAttributes, ReactNode } from 'react';

/** Bordered group of rows or content, as on the settings pages. */
export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <section className={`rounded-card border border-line-light bg-surface-card p-4 ${className}`} {...props}>{children}</section>;
}

/** Card without its own fill, for rows on the page background. */
export function RowCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`divide-y divide-line-light rounded-card border border-line px-4 ${className}`}>{children}</div>;
}

/** One settings row: name on the left, control on the right. */
export function SettingsRow({ label, description, children }: { label: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex min-h-composer items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm text-ink">{label}</p>
        {description !== undefined ? <p className="mt-0.5 text-xs text-ink-tertiary">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
