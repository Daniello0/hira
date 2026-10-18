'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '../../../features/auth/session.store';
import { SessionStatus } from '../../../features/auth/session-status';
import { useChatList } from '../../../features/chat/chat-list.store';

/** Opens the newest chat, or waits until the demo chat exists. */
export default function ChatIndexPage() {
  const chats = useChatList((state) => state.chats);
  const status = useSession((state) => state.status);
  const router = useRouter();
  useEffect(() => {
    const open = chats.find((chat) => !chat.isArchived) ?? chats[0];
    if (open !== undefined) router.replace(`/chat/${open.id}`);
  }, [chats, router]);
  if (status === SessionStatus.Unknown) return <p className="p-6">Loading…</p>;
  return <p className="p-6">Start a chat</p>;
}
