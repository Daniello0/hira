'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button } from '../../../common/components/button';
import { useSession } from '../../../features/auth/session.store';
import { SessionStatus } from '../../../features/auth/session-status';
import { useChatList } from '../../../features/chat/chat-list.store';
import { useNewChat } from '../../../features/chat/new-chat';
import { SignUpLinks } from '../../../features/chat/sign-up-links';

/** Opens the newest chat, or offers to start one when there is none. */
export default function ChatIndexPage() {
  const chats = useChatList((state) => state.chats);
  const loaded = useChatList((state) => state.loaded);
  const status = useSession((state) => state.status);
  const router = useRouter();
  useEffect(() => {
    const open = chats.find((chat) => !chat.isArchived) ?? chats[0];
    if (open !== undefined) router.replace(`/chat/${open.id}`);
  }, [chats, router]);
  if (status === SessionStatus.Unknown || !loaded || chats.length > 0) return <p className="p-6">Loading…</p>;
  return <EmptyChats demo={status !== SessionStatus.Account} />;
}

function EmptyChats({ demo }: { demo: boolean }) {
  const action = useNewChat();
  return (
    <section className="mx-auto max-w-md space-y-3 p-6">
      <h1 className="text-xl font-semibold">Start a chat</h1>
      <p className="text-sm text-hira-muted">Ask Hira about jobs, skills, or your next career step.</p>
      <Button type="button" className="flex items-center gap-2" disabled={action.busy} onClick={() => void action.create()}>
        <Plus size={16} /> New chat
      </Button>
      {action.limited && demo ? <SignUpLinks className="text-sm" /> : null}
      {action.error !== null ? <p role="alert" className="text-sm">{action.error}</p> : null}
    </section>
  );
}
