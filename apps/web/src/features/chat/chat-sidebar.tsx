'use client';

import { Phone, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ChatSummary, CurrentUserDto } from '@hira/contracts';
import { authedFetch } from '../../common/api/authed-fetch';
import { Button } from '../../common/components/button';
import { useSession } from '../auth/session.store';
import { SignUpLinks } from './sign-up-links';
import { fetchChats } from './chat-api';
import { useChatList } from './chat-list.store';
import { ChatRow } from './chat-row';
import { useNewChat } from './new-chat';

const ACCOUNT_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/library', label: 'Library' },
  { href: '/memory', label: 'Memory' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/billing', label: 'Billing' },
] as const;

/** Chat list, account pages, and Call. */
export function ChatSidebar({ user }: { user: CurrentUserDto | null }) {
  const chats = useChatList((state) => state.chats);
  const active = chats.filter((chat) => !chat.isArchived);
  const archived = chats.filter((chat) => chat.isArchived);
  return (
    <div className="flex h-full flex-col gap-4">
      <NewChat user={user} />
      <ChatRows chats={active} />
      <LoadMore />
      <ArchivedRows chats={archived} />
      <AccountLinks />
      <CallLink />
      <AccountLink user={user} />
      <QuotaLine user={user} />
    </div>
  );
}

function NewChat({ user }: { user: CurrentUserDto | null }) {
  const action = useNewChat();
  return (
    <div>
      <Button type="button" disabled={action.busy} className="flex w-full items-center justify-center gap-2" onClick={() => void action.create()}>
        <Plus size={16} /> New chat
      </Button>
      {action.limited && user === null ? <SignUpLinks className="mt-2 text-sm" /> : null}
      {action.error !== null ? <p role="alert" className="mt-2 text-sm">{action.error}</p> : null}
    </div>
  );
}

function ChatRows({ chats }: { chats: readonly ChatSummary[] }) {
  return (
    <ul className="space-y-1">
      {chats.map((chat) => <ChatRow key={chat.id} chat={chat} />)}
    </ul>
  );
}

function LoadMore() {
  const cursor = useChatList((state) => state.nextCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  if (cursor === null) return null;
  return (
    <div className="text-sm">
      <button type="button" className="text-hira-muted underline disabled:opacity-50" disabled={busy} onClick={() => void loadMore(cursor, setBusy, setFailed)}>
        {busy ? 'Loading…' : 'Load more'}
      </button>
      {failed ? <p role="alert">Could not load more chats</p> : null}
    </div>
  );
}

async function loadMore(cursor: string, setBusy: (value: boolean) => void, setFailed: (value: boolean) => void): Promise<void> {
  setBusy(true);
  try {
    const page = await fetchChats(cursor);
    setFailed(page === null);
    if (page !== null) useChatList.getState().appendPage(page.items, page.nextCursor);
  } catch {
    setFailed(true);
  } finally {
    setBusy(false);
  }
}

function ArchivedRows({ chats }: { chats: readonly ChatSummary[] }) {
  if (chats.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-hira-muted">Archived</p>
      <ChatRows chats={chats} />
    </div>
  );
}

function AccountLinks() {
  const pathname = usePathname();
  return (
    <ul className="space-y-1 text-sm">
      {ACCOUNT_LINKS.map((link) => (
        <li key={link.href}>
          <Link className={pathname === link.href ? 'text-hira-text' : 'text-hira-muted'} href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  );
}

function AccountLink({ user }: { user: CurrentUserDto | null }) {
  const setAnonymous = useSession((state) => state.setAnonymous);
  const router = useRouter();
  if (user === null) return <Link href="/login">Sign in</Link>;
  return <button type="button" className="text-left text-sm text-hira-muted" onClick={() => void signOut(setAnonymous, router)}>Sign out</button>;
}

async function signOut(setAnonymous: () => void, router: ReturnType<typeof useRouter>): Promise<void> {
  try {
    await authedFetch('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    setAnonymous();
    router.push('/login');
  }
}

function QuotaLine({ user }: { user: CurrentUserDto | null }) {
  if (user?.searchQuota === undefined) return null;
  return <p className="mt-auto text-sm text-hira-muted">{user.searchQuota.used}/{user.searchQuota.limit} queries today</p>;
}

function CallLink() {
  return (
    <Link className="flex items-center gap-2 text-sm" href="/call">
      <Phone size={16} /> Call
    </Link>
  );
}

/** Loads the first page of the sidebar once the session is known. */
export async function refreshChatList(): Promise<void> {
  try {
    const page = await fetchChats();
    if (page !== null) useChatList.getState().setChats(page.items, page.nextCursor);
    else useChatList.setState({ loaded: true });
  } catch {
    // The sidebar keeps its rows; the next turn or session change retries.
    useChatList.setState({ loaded: true });
  }
}
