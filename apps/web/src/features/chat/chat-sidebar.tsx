'use client';

import { Phone, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ChatSummary, CurrentUserDto } from '@hira/contracts';
import { coreFetch } from '../../common/api/core-api';
import { Button } from '../../common/components/button';
import { useSession } from '../auth/session.store';
import { SignUpLinks } from './sign-up-links';
import { createChat, deleteChat, fetchChats, patchChat } from './chat-api';
import { useChatList } from './chat-list.store';

interface ChatSidebarProps {
  token: string | null;
  user: CurrentUserDto | null;
}

const ACCOUNT_LINKS = [
  { href: '/profile', label: 'Profile' },
  { href: '/library', label: 'Library' },
  { href: '/memory', label: 'Memory' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/billing', label: 'Billing' },
] as const;

/** Chat list, account pages, and Call. */
export function ChatSidebar({ token, user }: ChatSidebarProps) {
  const chats = useChatList((state) => state.chats);
  const active = chats.filter((chat) => !chat.isArchived);
  const archived = chats.filter((chat) => chat.isArchived);
  return (
    <div className="flex h-full flex-col gap-4">
      <NewChat token={token} user={user} />
      <ChatRows chats={active} token={token} />
      <ArchivedRows chats={archived} token={token} />
      <AccountLinks />
      <CallLink />
      <AccountLink token={token} user={user} />
      <QuotaLine user={user} />
    </div>
  );
}

function NewChat({ token, user }: ChatSidebarProps) {
  const router = useRouter();
  const upsert = useChatList((state) => state.upsert);
  const [banner, setBanner] = useState(false);
  return (
    <div>
      <Button type="button" className="flex w-full items-center justify-center gap-2" onClick={() => void add(token, router, upsert, setBanner)}>
        <Plus size={16} /> New chat
      </Button>
      {banner && user === null ? <SignUpLinks className="mt-2 text-sm" /> : null}
    </div>
  );
}

async function add(token: string | null, router: ReturnType<typeof useRouter>, upsert: (chat: ChatSummary) => void, setBanner: (value: boolean) => void): Promise<void> {
  const created = await createChat(token);
  if (created.chat === null) {
    setBanner(created.limited);
    return;
  }
  upsert(created.chat);
  router.push(`/chat/${created.chat.id}`);
}

function ChatRows({ chats, token }: { chats: readonly ChatSummary[]; token: string | null }) {
  return (
    <ul className="space-y-1">
      {chats.map((chat) => <ChatRow key={chat.id} chat={chat} token={token} />)}
    </ul>
  );
}

function ArchivedRows({ chats, token }: { chats: readonly ChatSummary[]; token: string | null }) {
  if (chats.length === 0) return null;
  return (
    <div>
      <p className="text-xs text-hira-muted">Archived</p>
      <ChatRows chats={chats} token={token} />
    </div>
  );
}

function ChatRow({ chat, token }: { chat: ChatSummary; token: string | null }) {
  const pathname = usePathname();
  const selected = pathname === `/chat/${chat.id}`;
  return (
    <li className={selected ? 'rounded-md bg-white/10' : ''}>
      <Link className="block truncate px-2 py-1" href={`/chat/${chat.id}`}>{chat.title ?? 'New chat'}</Link>
      <RowActions chat={chat} token={token} />
    </li>
  );
}

function RowActions({ chat, token }: { chat: ChatSummary; token: string | null }) {
  const router = useRouter();
  const upsert = useChatList((state) => state.upsert);
  const remove = useChatList((state) => state.remove);
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex gap-2 px-2 pb-1 text-xs text-hira-muted">
      <button type="button" onClick={() => void rename(chat, token, upsert)}>Rename</button>
      <button type="button" onClick={() => void archive(chat, token, upsert)}>Archive</button>
      <button type="button" onClick={() => void removeChat(chat.id, token, confirming, setConfirming, remove, router)}>{confirming ? 'Confirm delete' : 'Delete'}</button>
    </div>
  );
}

async function rename(chat: ChatSummary, token: string | null, upsert: (chat: ChatSummary) => void): Promise<void> {
  const title = window.prompt('Chat name', chat.title ?? '');
  if (title === null || title.trim().length === 0) return;
  const updated = await patchChat(token, chat.id, { title: title.trim() });
  if (updated !== null) upsert(updated);
}

async function archive(chat: ChatSummary, token: string | null, upsert: (chat: ChatSummary) => void): Promise<void> {
  const updated = await patchChat(token, chat.id, { isArchived: true });
  if (updated !== null) upsert(updated);
}

async function removeChat(
  chatId: string,
  token: string | null,
  confirming: boolean,
  setConfirming: (value: boolean) => void,
  remove: (chatId: string) => void,
  router: ReturnType<typeof useRouter>,
): Promise<void> {
  if (!confirming) {
    setConfirming(true);
    return;
  }
  if (await deleteChat(token, chatId)) {
    remove(chatId);
    router.push('/chat');
  }
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

function AccountLink({ token, user }: ChatSidebarProps) {
  const setAnonymous = useSession((state) => state.setAnonymous);
  const router = useRouter();
  if (user === null) return <Link href="/login">Sign in</Link>;
  return <button type="button" className="text-sm text-hira-muted" onClick={() => void signOut(token, setAnonymous, router)}>Sign out</button>;
}

async function signOut(token: string | null, setAnonymous: () => void, router: ReturnType<typeof useRouter>): Promise<void> {
  await coreFetch('/api/v1/auth/logout', { method: 'POST' }, token);
  setAnonymous();
  router.push('/login');
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

/** Loads the sidebar once the session is known. */
export async function refreshChatList(token: string | null): Promise<void> {
  const page = await fetchChats(token);
  if (page === null) return;
  useChatList.getState().setChats(page.items, page.nextCursor);
}
