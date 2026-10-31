'use client';

import { Check } from 'lucide-react';
import Link from 'next/link';
import { DropdownMenu } from 'radix-ui';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { Tooltip } from './tooltip';

export type MenuEntry =
  | { kind: 'item'; label: string; description?: string; icon?: ReactNode; danger?: boolean; disabled?: boolean; onSelect: () => void }
  | { kind: 'link'; label: string; description?: string; icon?: ReactNode; href: string }
  | { kind: 'check'; label: string; description?: string; icon?: ReactNode; checked: boolean; onChange: (checked: boolean) => void }
  | { kind: 'separator' }
  | { kind: 'note'; content: ReactNode };

interface MenuProps {
  /** A button; the menu opens from it. */
  trigger: ReactElement;
  /** Hint on the trigger while the menu is closed. */
  tooltip?: string;
  entries: readonly MenuEntry[];
  side?: 'top' | 'bottom' | 'right';
  align?: 'start' | 'center' | 'end';
  alignOffset?: number;
  sideOffset?: number;
  width?: 'menu' | 'wide';
  /** Measured width, when the menu matches another element. */
  matchWidth?: number | null;
}

const ROW_CLASS = 'flex min-h-menu-row w-full cursor-pointer items-center gap-2 rounded-menu-item px-2.5 py-1.5 text-left text-sm text-ink outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-hover';
const WIDTH = { menu: 'w-menu', wide: 'w-menu-wide' } as const;

/** Dropdown menu in the elevated style: rounded, blurred, keyboard-driven. */
export function Menu({ trigger, tooltip, entries, side = 'bottom', align = 'start', alignOffset = 0, sideOffset = 6, width = 'menu', matchWidth = null }: MenuProps) {
  const button = <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>;
  const style: CSSProperties | undefined = matchWidth === null ? undefined : { width: matchWidth };
  return (
    <DropdownMenu.Root>
      {tooltip === undefined ? button : <Tooltip label={tooltip}>{button}</Tooltip>}
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side={side}
          align={align}
          alignOffset={alignOffset}
          sideOffset={sideOffset}
          collisionPadding={8}
          style={style}
          className={`motion-menu scroll-thin z-50 max-h-(--radix-dropdown-menu-content-available-height) overflow-y-auto rounded-menu bg-surface-menu p-1.5 text-ink shadow-menu backdrop-blur-sm ${matchWidth === null ? WIDTH[width] : ''}`}
        >
          {entries.map((entry, index) => <Entry key={index} entry={entry} />)}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Entry({ entry }: { entry: MenuEntry }) {
  if (entry.kind === 'separator') return <DropdownMenu.Separator className="mx-2.5 my-1 h-px bg-line" />;
  if (entry.kind === 'note') return <div className="px-2.5 py-1.5 text-sm">{entry.content}</div>;
  if (entry.kind === 'link') {
    return (
      <DropdownMenu.Item asChild className={ROW_CLASS}>
        <Link href={entry.href}><RowBody icon={entry.icon} label={entry.label} description={entry.description} /></Link>
      </DropdownMenu.Item>
    );
  }
  if (entry.kind === 'check') {
    return (
      <DropdownMenu.CheckboxItem className={ROW_CLASS} checked={entry.checked} onCheckedChange={entry.onChange} onSelect={(event) => event.preventDefault()}>
        <RowBody icon={entry.icon} label={entry.label} description={entry.description} />
        <DropdownMenu.ItemIndicator className="ml-auto motion-fade text-accent-focus"><Check className="size-icon-sm" aria-hidden="true" /></DropdownMenu.ItemIndicator>
      </DropdownMenu.CheckboxItem>
    );
  }
  return (
    <DropdownMenu.Item className={`${ROW_CLASS} ${entry.danger === true ? 'text-danger' : ''}`} disabled={entry.disabled} onSelect={entry.onSelect}>
      <RowBody icon={entry.icon} label={entry.label} description={entry.description} />
    </DropdownMenu.Item>
  );
}

function RowBody({ icon, label, description }: { icon?: ReactNode; label: string; description?: string }) {
  return (
    <>
      {icon !== undefined ? <span className="flex size-icon shrink-0 items-center justify-center">{icon}</span> : null}
      <span className="min-w-0 truncate">
        {label}
        {description !== undefined ? <span className="ml-2 hidden text-ink-tertiary md:inline">{description}</span> : null}
      </span>
    </>
  );
}
