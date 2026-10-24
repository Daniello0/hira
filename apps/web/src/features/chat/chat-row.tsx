'use client';

import type { ChatSummary } from '@hira/contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useConfirm } from '../../common/hooks/use-confirm';
import { deleteChat, patchChat } from './chat-api';
import { useChatList } from './chat-list.store';

const ACTION_CLASS = 'hover:text-hira-text';

/** One sidebar chat: open, rename in place, archive or restore, delete. */
export function ChatRow({ chat }: { chat: ChatSummary }) {
  const pathname = usePathname();
  const selected = pathname === `/chat/${chat.id}`;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <li className={selected ? 'rounded-md bg-white/10' : ''}>
      {editing ? (
        <RenameField chat={chat} onDone={() => setEditing(false)} onError={setError} />
      ) : (
        <Link className="block truncate px-2 py-1" href={`/chat/${chat.id}`}>{chat.title ?? 'New chat'}</Link>
      )}
      <RowActions chat={chat} selected={selected} onRename={() => setEditing(true)} onError={setError} />
      {error !== null ? <p role="alert" className="px-2 pb-1 text-xs text-red-300">{error}</p> : null}
    </li>
  );
}

function RenameField({ chat, onDone, onError }: { chat: ChatSummary; onDone: () => void; onError: (value: string | null) => void }) {
  const [title, setTitle] = useState(chat.title ?? '');
  const commit = () => void rename(chat, title, onError).finally(onDone);
  return (
    <input
      aria-label="Chat name"
      autoFocus
      className="w-full rounded-md border border-white/15 bg-hira-bg px-2 py-1 text-sm"
      value={title}
      onChange={(event) => setTitle(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') onDone();
      }}
    />
  );
}

function RowActions({ chat, selected, onRename, onError }: { chat: ChatSummary; selected: boolean; onRename: () => void; onError: (value: string | null) => void }) {
  const router = useRouter();
  const confirm = useConfirm();
  const onDelete = () => {
    if (!confirm.armed) return confirm.arm();
    confirm.reset();
    void removeChat(chat.id, selected, router, onError);
  };
  return (
    <div className="flex gap-2 px-2 pb-1 text-xs text-hira-muted">
      <button type="button" className={ACTION_CLASS} onClick={onRename}>Rename</button>
      <button type="button" className={ACTION_CLASS} onClick={() => void setArchived(chat, !chat.isArchived, onError)}>
        {chat.isArchived ? 'Restore' : 'Archive'}
      </button>
      <button type="button" className={ACTION_CLASS} onClick={onDelete} onBlur={confirm.reset}>
        {confirm.armed ? 'Confirm delete' : 'Delete'}
      </button>
    </div>
  );
}

async function rename(chat: ChatSummary, title: string, onError: (value: string | null) => void): Promise<void> {
  const next = title.trim();
  if (next.length === 0 || next === (chat.title ?? '')) return;
  const updated = await guarded(() => patchChat(chat.id, { title: next }));
  onError(updated === null ? 'Could not rename the chat' : null);
  if (updated !== null) useChatList.getState().replace(updated);
}

async function setArchived(chat: ChatSummary, isArchived: boolean, onError: (value: string | null) => void): Promise<void> {
  const updated = await guarded(() => patchChat(chat.id, { isArchived }));
  onError(updated === null ? `Could not ${isArchived ? 'archive' : 'restore'} the chat` : null);
  if (updated !== null) useChatList.getState().replace(updated);
}

async function removeChat(chatId: string, selected: boolean, router: ReturnType<typeof useRouter>, onError: (value: string | null) => void): Promise<void> {
  const ok = await guarded(() => deleteChat(chatId));
  onError(ok ? null : 'Could not delete the chat');
  if (ok !== true) return;
  useChatList.getState().remove(chatId);
  if (selected) router.push('/chat');
}

async function guarded<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}
