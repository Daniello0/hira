import type { ReactNode } from 'react';

/** Error or status line under a form. */
export function AlertText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p role="alert" className={`motion-fade text-sm text-danger ${className}`}>{children}</p>;
}

/** Quiet explanation line. */
export function MutedText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-sm text-ink-tertiary ${className}`}>{children}</p>;
}

/** Text with a moving highlight while something is working. */
export function ShimmerText({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`motion-shimmer inline-block ${className}`}>{children}</span>;
}

/** Placeholder rows while a list loads. */
export function SkeletonList({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => <div key={index} className="motion-skeleton h-composer rounded-card" />)}
    </div>
  );
}
