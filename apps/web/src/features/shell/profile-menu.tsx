'use client';

import { Brain, LogIn, LogOut, Settings, Sparkles, User, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CurrentUserDto } from '@hira/contracts';
import { buttonClass } from '../../common/components/button';
import { Menu, type MenuEntry } from '../../common/components/menu';
import { useSession } from '../auth/session.store';
import { signOut } from '../auth/sign-out';

/** Avatar with the account menu. `full` adds the name and the Upgrade pill. */
export function ProfileMenu({ full }: { full: boolean }) {
  const user = useSession((state) => state.user);
  const router = useRouter();
  const entries = user === null ? guestEntries() : accountEntries(user, () => void signOut(router));
  const name = displayName(user);
  return (
    <>
      <Menu
        side="top"
        width="wide"
        entries={entries}
        trigger={
          <button type="button" aria-label="Open profile menu" className={full ? 'flex min-w-0 flex-1 items-center gap-2 rounded-row p-1.5 text-left transition-colors hover:bg-hover' : 'rounded-full p-1.5 transition-colors hover:bg-hover'}>
            <Avatar name={name} />
            {full ? <AccountLabel name={name} plan={user === null ? 'Demo' : 'Free'} /> : null}
          </button>
        }
      />
      {full ? <Link href="/settings/billing" className={buttonClass('secondary', 'sm')}>Upgrade</Link> : null}
    </>
  );
}

function Avatar({ name }: { name: string }) {
  return <span className="flex size-avatar shrink-0 items-center justify-center rounded-full bg-accent text-xs font-medium text-on-accent uppercase">{name.slice(0, 1)}</span>;
}

function AccountLabel({ name, plan }: { name: string; plan: string }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm text-ink">{name}</span>
      <span className="block text-xs text-ink-tertiary">{plan}</span>
    </span>
  );
}

function displayName(user: CurrentUserDto | null): string {
  if (user === null) return 'Guest';
  return user.displayName ?? user.email;
}

function accountEntries(user: CurrentUserDto, onSignOut: () => void): MenuEntry[] {
  const quota = user.searchQuota === undefined ? [] : [quotaNote(user.searchQuota.used, user.searchQuota.limit)];
  return [
    ...quota,
    { kind: 'link', label: 'Upgrade plan', href: '/settings/billing', icon: <Sparkles className="size-icon-md" aria-hidden="true" /> },
    { kind: 'link', label: 'Memory', href: '/settings/memory', icon: <Brain className="size-icon-md" aria-hidden="true" /> },
    { kind: 'link', label: 'Profile', href: '/settings/profile', icon: <User className="size-icon-md" aria-hidden="true" /> },
    { kind: 'link', label: 'Settings', href: '/settings/appearance', icon: <Settings className="size-icon-md" aria-hidden="true" /> },
    { kind: 'separator' },
    { kind: 'item', label: 'Log out', icon: <LogOut className="size-icon-md" aria-hidden="true" />, onSelect: onSignOut },
  ];
}

function quotaNote(used: number, limit: number): MenuEntry {
  return { kind: 'note', content: <span className="text-ink-tertiary">{used}/{limit} queries today</span> };
}

function guestEntries(): MenuEntry[] {
  return [
    { kind: 'link', label: 'Sign in', href: '/login', icon: <LogIn className="size-icon-md" aria-hidden="true" /> },
    { kind: 'link', label: 'Sign up', href: '/register', icon: <UserPlus className="size-icon-md" aria-hidden="true" /> },
    { kind: 'separator' },
    { kind: 'link', label: 'Upgrade plan', href: '/settings/billing', icon: <Sparkles className="size-icon-md" aria-hidden="true" /> },
    { kind: 'link', label: 'Settings', href: '/settings/appearance', icon: <Settings className="size-icon-md" aria-hidden="true" /> },
  ];
}
