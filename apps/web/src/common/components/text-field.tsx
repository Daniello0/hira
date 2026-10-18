import type { InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/** Labeled input. The label is the accessible name. */
export function TextField({ label, id, ...props }: TextFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-');
  return (
    <label className="block text-sm text-hira-muted" htmlFor={fieldId}>
      {label}
      <input id={fieldId} className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" {...props} />
    </label>
  );
}
