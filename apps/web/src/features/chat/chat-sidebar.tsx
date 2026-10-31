'use client';

import type { ChatSummary } from '@hira/contracts';
import { useEffect, useRef, useState } from 'react';
import { AlertText } from '../../common/components/feedback';
import { Collapsible } from '../../common/components/collapsible';
import { fetchChats } from './chat-api';
import { useChatList } from './chat-list.store';
import { ChatRow } from './chat-row';

/** Recent chats in the sidebar. Archived chats live on their settings page. */
export function ChatRecents() {
  const chats = useChatList((state) => state.chats);
  const active = chats.filter((chat) => !chat.isArchived);
  return (
    <div className="mt-5 px-2">
      <Collapsible defaultOpen summary="Recents" triggerClassName="-mx-2 mb-1 flex h-row w-full items-center gap-1 rounded-row px-2 text-sm text-ink-tertiary hover:bg-hover">
        <ChatRows chats={active} />
        <LoadMore />
      </Collapsible>
    </div>
  );
}

/** Rows shared by the sidebar and the archive page. */
export function ChatRows({ chats }: { chats: readonly ChatSummary[] }) {
  return (
    <ul className="-mx-2 space-y-0.5">
      {chats.map((chat) => <ChatRow key={chat.id} chat={chat} />)}
    </ul>
  );
}

/** Loads the next page when the end of the list scrolls into view. */
export function LoadMore() {
  const cursor = useChatList((state) => state.nextCursor);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (node === null || cursor === null || failed) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMore(cursor, setBusy, setFailed);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, failed]);
  if (cursor === null) return null;
  return (
    <div ref={sentinel} className="py-2 text-sm">
      {busy ? <span className="motion-pulse text-ink-tertiary">Loading…</span> : null}
      {failed ? (
        <>
          <AlertText>Could not load more chats</AlertText>
          <button type="button" className="mt-1 text-ink-secondary underline" onClick={() => setFailed(false)}>Try again</button>
        </>
      ) : null}
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
