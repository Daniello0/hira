'use client';

import { ChevronDown } from 'lucide-react';
import { Collapsible as RadixCollapsible } from 'radix-ui';
import type { ReactNode } from 'react';

interface CollapsibleProps {
  summary: ReactNode;
  /** Controlled state; leave out to let the block keep its own. */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  defaultOpen?: boolean;
  triggerClassName?: string;
  children: ReactNode;
}

/** Expandable block: the chevron turns and the height animates both ways. */
export function Collapsible({ summary, open, onToggle, defaultOpen, triggerClassName = 'text-sm text-ink-secondary hover:text-ink', children }: CollapsibleProps) {
  return (
    <RadixCollapsible.Root open={open} defaultOpen={defaultOpen} onOpenChange={onToggle}>
      <RadixCollapsible.Trigger className={`inline-flex items-center gap-1 transition-colors ${triggerClassName}`}>
        {summary}
        <ChevronDown size={14} aria-hidden="true" className="motion-chevron" />
      </RadixCollapsible.Trigger>
      <RadixCollapsible.Content className="motion-collapsible">{children}</RadixCollapsible.Content>
    </RadixCollapsible.Root>
  );
}
