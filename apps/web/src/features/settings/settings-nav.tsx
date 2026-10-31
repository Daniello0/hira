'use client';

import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { navRowClass } from '../shell/sidebar';
import { SETTINGS_SECTIONS } from './settings.constants';

/** Sections in the sidebar: back to the app, a filter, and the list. */
export function SettingsNav() {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const sections = SETTINGS_SECTIONS.filter((section) => section.label.toLowerCase().includes(needle));
  return (
    <nav aria-label="Settings">
      <Link className={navRowClass(false)} href="/chat"><ArrowLeft size={20} aria-hidden="true" /> Back to app</Link>
      <div className="my-2 flex h-control items-center gap-2 rounded-full bg-surface-raised px-3 text-ink-tertiary transition-colors focus-within:text-ink">
        <Search size={16} aria-hidden="true" className="shrink-0" />
        <input
          aria-label="Search settings"
          placeholder="Search"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="px-2 pt-1 pb-1 text-sm text-ink-tertiary">Personal</p>
      <ul className="space-y-0.5">
        {sections.map(({ href, label, Icon }) => (
          <li key={href}>
            <Link className={navRowClass(pathname === href)} aria-current={pathname === href ? 'page' : undefined} href={href}>
              <Icon size={20} aria-hidden="true" /> {label}
            </Link>
          </li>
        ))}
        {sections.length === 0 ? <li className="px-2 py-1 text-sm text-ink-tertiary">Nothing found</li> : null}
      </ul>
    </nav>
  );
}
