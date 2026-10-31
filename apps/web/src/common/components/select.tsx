'use client';

import { Check, ChevronDown } from 'lucide-react';
import { Select as RadixSelect } from 'radix-ui';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  /** Visible label above the pill. Without it, pass `ariaLabel`. */
  label?: string;
  ariaLabel?: string;
  value?: string;
  defaultValue?: string;
  /** Form field name, for forms read with `FormData`. */
  name?: string;
  options: readonly SelectOption[];
  onChange?: (value: string) => void;
  className?: string;
}

// Radix reserves the empty string, while "Not set" options use it.
const EMPTY_VALUE = '__empty__';

function toRadix(value: string | undefined): string | undefined {
  return value === '' ? EMPTY_VALUE : value;
}

/** Pill dropdown that replaces the native select, with the same open and close motion as menus. */
export function Select({ label, ariaLabel, value, defaultValue, name, options, onChange, className = '' }: SelectProps) {
  const control = (
    <RadixSelect.Root name={name} value={toRadix(value)} defaultValue={toRadix(defaultValue)} onValueChange={(next) => onChange?.(next === EMPTY_VALUE ? '' : next)}>
      <RadixSelect.Trigger aria-label={ariaLabel ?? label} className="group inline-flex h-action max-w-full items-center gap-1.5 rounded-full border border-line px-3 text-sm text-ink transition-colors hover:bg-hover focus-visible:outline-accent-focus">
        <span className="truncate"><RadixSelect.Value /></span>
        <RadixSelect.Icon className="motion-chevron text-ink-tertiary"><ChevronDown className="size-icon-xs" aria-hidden="true" /></RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content position="popper" sideOffset={6} className="motion-menu z-50 max-h-list-max min-w-(--radix-select-trigger-width) overflow-hidden rounded-menu bg-surface-menu p-1.5 text-ink shadow-menu backdrop-blur-sm">
          <RadixSelect.Viewport>
            {options.map((option) => (
              <RadixSelect.Item key={option.value} value={toRadix(option.value) ?? EMPTY_VALUE} className="flex min-h-menu-row cursor-pointer items-center justify-between gap-3 rounded-menu-item px-2.5 py-1.5 text-sm outline-none select-none data-[highlighted]:bg-hover">
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator><Check className="size-icon-sm" aria-hidden="true" /></RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
  if (label === undefined) return control;
  return (
    <div className={`block text-sm text-ink-secondary ${className}`}>
      <span className="mb-1 block">{label}</span>
      {control}
    </div>
  );
}
