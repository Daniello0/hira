'use client';

import { Check } from 'lucide-react';
import { Checkbox as RadixCheckbox } from 'radix-ui';
import type { ReactNode } from 'react';

/** Check box with its label. */
export function Checkbox({ checked, onChange, disabled = false, children }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; children: ReactNode }) {
  return (
    <label className={`flex items-start gap-2 text-sm text-ink ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
      <RadixCheckbox.Root
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onChange(next === true)}
        className="mt-0.5 flex size-icon-sm shrink-0 items-center justify-center rounded-sm border border-line-heavy transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent"
      >
        <RadixCheckbox.Indicator className="motion-fade text-on-accent"><Check className="size-icon-2xs" aria-hidden="true" strokeWidth={3} /></RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      <span>{children}</span>
    </label>
  );
}
