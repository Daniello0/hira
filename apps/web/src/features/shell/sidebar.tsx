'use client';

import { AudioLines, Bookmark, Library, PanelLeft, Search, SquarePen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { IconButton, IconLink } from '../../common/components/icon-button';
import { HiraLogo } from '../../common/components/logo';
import { ChatRecents } from '../chat/chat-sidebar';
import { SettingsNav } from '../settings/settings-nav';
import { ProfileMenu } from './profile-menu';
import { useShell } from './shell.store';

const NAV_ICON_SIZE = 20;

const NAV_LINKS = [
  { href: '/library', label: 'Library', icon: <Library size={NAV_ICON_SIZE} aria-hidden="true" /> },
  { href: '/favorites', label: 'Favorites', icon: <Bookmark size={NAV_ICON_SIZE} aria-hidden="true" /> },
  { href: '/call', label: 'Call', icon: <AudioLines size={NAV_ICON_SIZE} aria-hidden="true" /> },
] as const;

/** Classes of one sidebar row. */
export function navRowClass(active: boolean): string {
  return `flex h-row w-full items-center gap-2 rounded-row px-2 text-sm text-ink transition-colors hover:bg-hover ${active ? 'bg-hover' : ''}`;
}

/** Column on desktop: the full panel and the rail swap places as the width changes. */
export function DesktopSidebar() {
  const collapsed = useShell((state) => state.sidebarCollapsed);
  return (
    <aside data-collapsed={collapsed} className="motion-width relative hidden w-sidebar shrink-0 overflow-hidden border-r border-line-light data-[collapsed=true]:w-rail md:block">
      <div inert={collapsed} className={`motion-swap absolute inset-y-0 left-0 w-sidebar ${collapsed ? 'opacity-0' : 'opacity-100'}`}>
        <SidebarContent />
      </div>
      <div inert={!collapsed} className={`motion-swap absolute inset-y-0 left-0 w-rail ${collapsed ? 'opacity-100' : 'opacity-0'}`}>
        <SidebarRail />
      </div>
    </aside>
  );
}

/** Full panel. Settings pages swap the chat navigation for their own sections. */
export function SidebarContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const settings = pathname.startsWith('/settings');
  return (
    <div className="flex h-full w-full flex-col">
      <SidebarTop onClose={onClose} />
      <div className="scroll-on-hover min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {settings ? <SettingsNav /> : <ChatNavigation pathname={pathname} />}
      </div>
      <div className="flex items-center gap-2 p-2">
        <ProfileMenu full />
      </div>
    </div>
  );
}

function SidebarTop({ onClose }: { onClose?: () => void }) {
  const toggleCollapsed = useShell((state) => state.toggleCollapsed);
  const setSearch = useShell((state) => state.setSearch);
  return (
    <div className="flex h-header shrink-0 items-center justify-between gap-1 px-2">
      <Link href="/chat" className="flex items-center gap-2 px-2 text-base font-semibold">
        <HiraLogo /> Hira
      </Link>
      <div className="flex items-center">
        <IconButton label="Search chats" onClick={() => setSearch(true)}><Search size={NAV_ICON_SIZE} aria-hidden="true" /></IconButton>
        {onClose !== undefined ? (
          <IconButton label="Close sidebar" onClick={onClose}><X size={NAV_ICON_SIZE} aria-hidden="true" /></IconButton>
        ) : (
          <IconButton label="Hide sidebar" onClick={toggleCollapsed}><PanelLeft size={NAV_ICON_SIZE} aria-hidden="true" /></IconButton>
        )}
      </div>
    </div>
  );
}

function ChatNavigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main">
      <ul className="space-y-0.5">
        <NavLink href="/chat" active={pathname === '/chat'} icon={<SquarePen size={NAV_ICON_SIZE} aria-hidden="true" />}>New chat</NavLink>
        {NAV_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} active={pathname === link.href} icon={link.icon}>{link.label}</NavLink>
        ))}
      </ul>
      <ChatRecents />
    </nav>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <li>
      <Link className={navRowClass(active)} aria-current={active ? 'page' : undefined} href={href}>
        {icon}
        {children}
      </Link>
    </li>
  );
}

function SidebarRail() {
  const toggleCollapsed = useShell((state) => state.toggleCollapsed);
  const setSearch = useShell((state) => state.setSearch);
  return (
    <div className="flex h-full flex-col items-center gap-1 py-2">
      <IconButton label="Show sidebar" tone="plain" onClick={toggleCollapsed}><PanelLeft size={NAV_ICON_SIZE} aria-hidden="true" /></IconButton>
      <IconLink label="New chat" href="/chat"><SquarePen size={NAV_ICON_SIZE} aria-hidden="true" /></IconLink>
      <IconButton label="Search chats" onClick={() => setSearch(true)}><Search size={NAV_ICON_SIZE} aria-hidden="true" /></IconButton>
      {NAV_LINKS.map((link) => <IconLink key={link.href} label={link.label} href={link.href}>{link.icon}</IconLink>)}
      <div className="mt-auto"><ProfileMenu full={false} /></div>
    </div>
  );
}
