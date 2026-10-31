'use client';

import type { ChatSummary } from '@hira/contracts';
import { MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from '../../common/components/dialog';
import { AlertText, MutedText } from '../../common/components/feedback';
import { useDebounced } from '../../common/hooks/use-debounced';
import { useLoadOnView } from '../../common/hooks/use-load-on-view';
import { searchChats } from '../chat/chat-api';
import { useChatList } from '../chat/chat-list.store';
import { appendHits, type SearchHits } from './search-results';
import { useShell } from './shell.store';

type Found = { kind: 'recent' } | { kind: 'loading' } | ({ kind: 'hits' } & SearchHits) | { kind: 'failed' };

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
          <Search aria-hidden="true" className="size-icon shrink-0 text-ink-tertiary" />
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
  const { found, loadMore, retryMore } = useFoundChats(query);
  const body = () => {
    if (found.kind === 'loading') return <MutedText className="px-3 py-2">Searching…</MutedText>;
    if (found.kind === 'failed') return <AlertText className="px-3 py-2">Could not search chats</AlertText>;
    const chats = found.kind === 'hits' ? found.chats : recent;
    if (chats.length === 0) return <MutedText className="px-3 py-2">{found.kind === 'hits' ? 'No chats found' : 'No chats yet'}</MutedText>;
    return (
      <>
        <ChatHits chats={chats} onPick={onPick} />
        {found.kind === 'hits' ? <MoreHits hits={found} onLoad={loadMore} onRetry={retryMore} /> : null}
      </>
    );
  };
  return <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-2">{body()}</div>;
}

function ChatHits({ chats, onPick }: { chats: readonly ChatSummary[]; onPick: () => void }) {
  return (
    <ul className="space-y-0.5">
      {chats.map((chat) => (
        <li key={chat.id}>
          <Link className="flex h-composer items-center gap-3 rounded-menu-item px-3 text-sm text-ink transition-colors hover:bg-hover" href={`/chat/${chat.id}`} onClick={onPick}>
            <MessageCircle aria-hidden="true" className="size-icon-md shrink-0 text-ink-tertiary" />
            <span className="truncate">{chat.title ?? 'New chat'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Loads the next page of results as the end of the list scrolls into view. */
function MoreHits({ hits, onLoad, onRetry }: { hits: SearchHits; onLoad: () => void; onRetry: () => void }) {
  const sentinel = useLoadOnView(hits.cursor !== null && !hits.moreFailed, hits.cursor, onLoad);
  if (hits.cursor === null) return null;
  return (
    <div ref={sentinel} className="px-3 py-2 text-sm">
      {hits.moreFailed ? (
        <>
          <AlertText>Could not load more chats</AlertText>
          <button type="button" className="mt-1 text-ink-secondary underline" onClick={onRetry}>Try again</button>
        </>
      ) : <span className="motion-pulse text-ink-tertiary">Loading…</span>}
    </div>
  );
}

function useFoundChats(query: string) {
  const needle = useDebounced(query.trim());
  const [found, setFound] = useState<Found>({ kind: 'recent' });
  const searched = useRef(needle);
  searched.current = needle;
  useEffect(() => {
    if (needle.length === 0) return setFound({ kind: 'recent' });
    let active = true;
    setFound({ kind: 'loading' });
    void searchChats(needle)
      .then((page) => active && setFound(page === null ? { kind: 'failed' } : { kind: 'hits', chats: page.items, cursor: page.nextCursor, moreFailed: false }))
      .catch(() => active && setFound({ kind: 'failed' }));
    return () => {
      active = false;
    };
  }, [needle]);
  const setMoreFailed = (moreFailed: boolean) => setFound((current) => (current.kind === 'hits' ? { ...current, moreFailed } : current));
  const loadMore = () => {
    if (found.kind !== 'hits' || found.cursor === null) return;
    const asked = needle;
    void searchChats(asked, found.cursor)
      .then((page) => {
        if (searched.current !== asked) return;
        if (page === null) return setMoreFailed(true);
        setFound((current) => (current.kind === 'hits' ? { kind: 'hits', ...appendHits(current, page) } : current));
      })
      .catch(() => {
        if (searched.current === asked) setMoreFailed(true);
      });
  };
  return { found, loadMore, retryMore: () => setMoreFailed(false) };
}
