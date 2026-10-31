'use client';

import { Switch as RadixSwitch } from 'radix-ui';

/** On/off control. The caller supplies the accessible name. */
export function Switch({ label, checked, onChange, disabled = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <RadixSwitch.Root
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      className="relative h-switch-h w-switch-w shrink-0 rounded-full bg-surface-control transition-colors data-[state=checked]:bg-accent disabled:opacity-50"
    >
      <RadixSwitch.Thumb className="block size-switch-thumb translate-x-0.5 rounded-full bg-on-accent transition-transform data-[state=checked]:translate-x-switch-travel" />
    </RadixSwitch.Root>
  );
}
