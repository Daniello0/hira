'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createChat } from './chat-api';
import { useChatList } from './chat-list.store';

/** "New chat" action shared by the sidebar and the empty chat page. */
export function useNewChat(): { create: () => Promise<void>; busy: boolean; limited: boolean; error: string | null } {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [limited, setLimited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function create(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createChat();
      setLimited(created.limited);
      if (created.chat === null) {
        if (!created.limited) setError('Could not create a chat');
        return;
      }
      useChatList.getState().upsert(created.chat);
      router.push(`/chat/${created.chat.id}`);
    } catch {
      setError('Could not reach Hira');
    } finally {
      setBusy(false);
    }
  }
  return { create, busy, limited, error };
}
