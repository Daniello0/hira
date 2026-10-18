import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: 'accent' | 'quiet';
}

/** English action button on the dark shell. */
export function Button({ children, className = '', tone = 'accent', ...props }: ButtonProps) {
  const toneClass = tone === 'accent' ? 'bg-hira-accent text-white' : 'bg-white/10 text-hira-text';
  return (
    <button className={`rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${toneClass} ${className}`} {...props}>
      {children}
    </button>
  );
}
