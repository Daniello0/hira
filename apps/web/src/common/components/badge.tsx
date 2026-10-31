import type { ReactNode } from 'react';

const TONE = {
  neutral: 'bg-hover text-ink',
  accent: 'bg-accent-soft text-on-accent-soft',
  solid: 'bg-accent text-on-accent',
} as const;

/** Small rounded label: a skill, a status, a score. */
export function Badge({ children, tone = 'neutral', className = '', title }: { children: ReactNode; tone?: keyof typeof TONE; className?: string; title?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${TONE[tone]} ${className}`}>{children}</span>;
}
