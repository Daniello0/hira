'use client';

import { PanelLeft, Sparkles, SquarePen } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { IconButton, IconLink } from '../../common/components/icon-button';
import { buttonClass } from '../../common/components/button';
import { useShell } from './shell.store';

/** Top bar of a page. On a phone it also opens the sidebar and starts a new chat. */
export function AppHeader({ children }: { children?: ReactNode }) {
  const setSidebar = useShell((state) => state.setSidebar);
  return (
    <header className="flex h-header shrink-0 items-center justify-between gap-2 px-2">
      <div className="flex items-center gap-2 md:hidden">
        <IconLink label="New chat" href="/chat"><SquarePen size={20} aria-hidden="true" /></IconLink>
        <IconButton label="Show sidebar" onClick={() => setSidebar(true)}><PanelLeft size={20} aria-hidden="true" /></IconButton>
      </div>
      <div className="ml-auto flex items-center gap-2">{children}</div>
    </header>
  );
}

/** The accent pill leading to the plans. */
export function UpgradeLink() {
  return (
    <Link href="/settings/billing" className={buttonClass('accent-soft')}>
      <Sparkles size={16} aria-hidden="true" /> Upgrade
    </Link>
  );
}

/** Page outside the chat: the top bar and one scrolling column. */
export function AppPage({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <AppHeader>{actions ?? <UpgradeLink />}</AppHeader>
      <div className="scroll-thread motion-fade min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
