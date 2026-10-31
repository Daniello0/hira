'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppHeader, UpgradeLink } from '../shell/app-header';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { createChat } from './chat-api';
import { useChatDraft } from './chat-draft.store';
import { useChatList } from './chat-list.store';
import { useForeignRemotePreference } from './foreign-remote-preference';
import { MessageInput } from './message-input';
import { homeDestination, markPendingSend, startChat } from './start-chat';

const HOME_DRAFT_KEY = 'home';
const GREETING = 'What are we looking for today?';

/** Empty screen for a new chat. Sending creates the chat, then the chat screen sends the text once. */
export function ChatHome() {
  const status = useSession((state) => state.status);
  const chats = useChatList((state) => state.chats);
  const loaded = useChatList((state) => state.loaded);
  const router = useRouter();
  const destination = loaded ? homeDestination(status, chats) : null;
  useEffect(() => {
    if (destination !== null) router.replace(destination);
  }, [destination, router]);
  const home = useHomeSend(router);
  const account = status === SessionStatus.Account;
  return (
    <div className="flex h-full flex-col">
      <AppHeader><UpgradeLink /></AppHeader>
      <div className="motion-fade flex min-h-0 flex-1 flex-col px-4 pb-4 md:justify-center md:pb-24">
        <div className="mx-auto flex w-full max-w-thread flex-1 flex-col md:flex-none">
          <div className="flex flex-1 items-center justify-center md:mb-6 md:flex-none">
            <h1 className="text-center text-2xl font-normal">{GREETING}</h1>
          </div>
          <MessageInput
            draft={home.draft}
            disabled={home.busy}
            archived={false}
            banner={home.limited ? 'limited' : null}
            notice={home.error}
            account={account}
            useMemory={home.useMemory}
            includeForeignRemote={home.includeForeignRemote}
            onUseMemory={home.setUseMemory}
            onIncludeForeignRemote={home.setIncludeForeignRemote}
            onDraft={home.setDraft}
            onSend={() => void home.send()}
          />
        </div>
      </div>
    </div>
  );
}

function useHomeSend(router: ReturnType<typeof useRouter>) {
  const draft = useChatDraft((state) => state.draftFor(HOME_DRAFT_KEY));
  const saveDraft = useChatDraft((state) => state.setDraft);
  const [busy, setBusy] = useState(false);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMemory, setUseMemory] = useState(true);
  const [includeForeignRemote, setIncludeForeignRemote] = useForeignRemotePreference();
  const send = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await startChat(draft, { create: createAndList });
    setBusy(false);
    setLimited(result.kind === 'limited');
    if (result.kind === 'failed') setError(result.message);
    if (result.kind !== 'started') return;
    saveDraft(result.chatId, draft);
    saveDraft(HOME_DRAFT_KEY, '');
    markPendingSend(result.chatId, { useMemory });
    router.push(`/chat/${result.chatId}`);
  };
  return { draft, setDraft: (value: string) => saveDraft(HOME_DRAFT_KEY, value), busy, limited, error, useMemory, setUseMemory, includeForeignRemote, setIncludeForeignRemote, send };
}

async function createAndList(): ReturnType<typeof createChat> {
  const created = await createChat();
  if (created.chat !== null) useChatList.getState().upsert(created.chat);
  return created;
}
