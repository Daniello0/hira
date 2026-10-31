import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/** Border, radius, and focus of every text box. */
export const FIELD_CLASS = 'w-full rounded-field border border-line bg-transparent px-3 py-2 text-base text-ink transition-colors placeholder:text-ink-tertiary hover:border-line-heavy focus:border-accent-focus focus:outline-none disabled:opacity-50 md:text-sm';

const LABEL_CLASS = 'block text-sm text-ink-secondary';

/** Labeled block around any control. */
export function FieldLabel({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`${LABEL_CLASS} ${className}`}>
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Labeled input. The label is the accessible name. */
export function TextField({ label, id, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className={`${LABEL_CLASS} ${className}`} htmlFor={fieldId}>
      {label}
      <input id={fieldId} className={`mt-1 ${FIELD_CLASS}`} {...props} />
    </label>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

/** Labeled multi-line input. */
export function TextArea({ label, className = '', rows = 3, ...props }: TextAreaProps) {
  return (
    <label className={`${LABEL_CLASS} ${className}`}>
      {label}
      <textarea rows={rows} className={`mt-1 scroll-thin ${FIELD_CLASS}`} {...props} />
    </label>
  );
}
