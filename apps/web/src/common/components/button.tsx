import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent-soft';
export type ButtonSize = 'sm' | 'md';

const BASE = 'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  secondary: 'border border-line bg-transparent text-ink hover:bg-hover',
  ghost: 'text-ink hover:bg-hover',
  danger: 'border border-line bg-transparent text-danger hover:bg-hover',
  'accent-soft': 'bg-accent-soft text-on-accent-soft hover:opacity-90',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-action px-3 text-sm',
  md: 'h-control px-4 text-sm',
};

/** Pill classes, also for a link that looks like a button. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return `${BASE} ${VARIANT[variant]} ${SIZE[size]}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

/** Pill action button. */
export function Button({ children, className = '', variant = 'primary', size = 'md', type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={`${buttonClass(variant, size)} ${className}`} {...props}>
      {children}
    </button>
  );
}
