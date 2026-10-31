import type { ReactNode } from 'react';

/** Heading of a page or settings section. */
export function PageHeading({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-normal">{title}</h1>
        {description !== undefined ? <p className="mt-2 text-sm text-ink-secondary">{description}</p> : null}
      </div>
      {children}
    </header>
  );
}

/** Heading of a block inside a page. */
export function SectionHeading({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-medium">{children}</h2>;
}

/** Centered reading column used by every page outside the chat. */
export function PageColumn({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-settings space-y-8 px-4 pt-4 pb-12 md:px-6 ${className}`}>{children}</div>;
}
