'use client';

import type { ChatSummary } from '@hira/contracts';
import { MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Dialog } from '../../common/components/dialog';
import { AlertText, MutedText } from '../../common/components/feedback';
import { useDebounced } from '../../common/hooks/use-debounced';
import { searchChats } from '../chat/chat-api';
import { useChatList } from '../chat/chat-list.store';
import { useShell } from './shell.store';

type Found = { kind: 'recent' } | { kind: 'loading' } | { kind: 'hits'; chats: ChatSummary[] } | { kind: 'failed' };

/** Finds chats by title on the server, so chats on pages not loaded yet are found too. */
export function SearchChatsDialog() {
  const open = useShell((state) => state.searchOpen);
  const setSearch = useShell((state) => state.setSearch);
  const [query, setQuery] = useState('');
  const close = () => {
    setSearch(false);
    setQuery('');
  };
  return (
    <Dialog open={open} onClose={close} title="Search chats" hideTitle size="wide">
      <div className="flex h-dialog-tall max-h-dvh flex-col">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <Search size={20} aria-hidden="true" className="shrink-0 text-ink-tertiary" />
          <input
            autoFocus
            aria-label="Search chats"
            placeholder="Search chats…"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-ink-tertiary"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Results query={query} onPick={close} />
      </div>
    </Dialog>
  );
}

function Results({ query, onPick }: { query: string; onPick: () => void }) {
  const recent = useChatList((state) => state.chats);
  const found = useFoundChats(query);
  const body = () => {
    if (found.kind === 'loading') return <MutedText className="px-3 py-2">Searching…</MutedText>;
    if (found.kind === 'failed') return <AlertText className="px-3 py-2">Could not search chats</AlertText>;
    const chats = found.kind === 'hits' ? found.chats : recent;
    if (chats.length === 0) return <MutedText className="px-3 py-2">{found.kind === 'hits' ? 'No chats found' : 'No chats yet'}</MutedText>;
    return <ChatHits chats={chats} onPick={onPick} />;
  };
  return <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">{body()}</div>;
}

function ChatHits({ chats, onPick }: { chats: readonly ChatSummary[]; onPick: () => void }) {
  return (
    <ul className="space-y-0.5">
      {chats.map((chat) => (
        <li key={chat.id}>
          <Link className="flex h-composer items-center gap-3 rounded-menu-item px-3 text-sm text-ink transition-colors hover:bg-hover" href={`/chat/${chat.id}`} onClick={onPick}>
            <MessageCircle size={18} aria-hidden="true" className="shrink-0 text-ink-tertiary" />
            <span className="truncate">{chat.title ?? 'New chat'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function useFoundChats(query: string): Found {
  const needle = useDebounced(query.trim());
  const [found, setFound] = useState<Found>({ kind: 'recent' });
  useEffect(() => {
    if (needle.length === 0) return setFound({ kind: 'recent' });
    let active = true;
    setFound({ kind: 'loading' });
    void searchChats(needle)
      .then((chats) => active && setFound(chats === null ? { kind: 'failed' } : { kind: 'hits', chats }))
      .catch(() => active && setFound({ kind: 'failed' }));
    return () => {
      active = false;
    };
  }, [needle]);
  return found;
}
