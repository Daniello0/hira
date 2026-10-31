'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Tooltip } from './tooltip';

export type IconButtonShape = 'header' | 'action' | 'round';
export type IconButtonTone = 'muted' | 'plain' | 'accent' | 'active';

const SHAPE: Record<IconButtonShape, string> = {
  header: 'size-control rounded-row',
  action: 'size-action rounded-row',
  round: 'size-control rounded-full',
};

const TONE: Record<IconButtonTone, string> = {
  muted: 'text-ink-tertiary hover:bg-hover hover:text-ink',
  plain: 'text-ink hover:bg-hover',
  accent: 'bg-accent text-on-accent hover:opacity-90',
  active: 'bg-hover text-ink',
};

/** Classes of a square or round icon control, also for a link that looks the same. */
export function iconButtonClass(shape: IconButtonShape = 'header', tone: IconButtonTone = 'muted'): string {
  return `inline-flex shrink-0 items-center justify-center transition-colors disabled:pointer-events-none disabled:opacity-40 ${SHAPE[shape]} ${TONE[tone]}`;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  shape?: IconButtonShape;
  tone?: IconButtonTone;
  /** Off for a button a menu or dialog wraps with its own trigger. */
  tooltip?: boolean;
  children: ReactNode;
}

/** Icon-only button with a tooltip. */
export function IconButton({ label, shape = 'header', tone = 'muted', tooltip = true, className = '', children, type = 'button', ...props }: IconButtonProps) {
  const button = (
    <button type={type} aria-label={label} className={`${iconButtonClass(shape, tone)} ${className}`} {...props}>
      {children}
    </button>
  );
  return tooltip ? <Tooltip label={label}>{button}</Tooltip> : button;
}

/** Icon-only link with a tooltip. */
export function IconLink({ label, href, shape = 'header', tone = 'muted', children }: { label: string; href: string; shape?: IconButtonShape; tone?: IconButtonTone; children: ReactNode }) {
  return (
    <Tooltip label={label}>
      <Link href={href} aria-label={label} className={iconButtonClass(shape, tone)}>
        {children}
      </Link>
    </Tooltip>
  );
}
