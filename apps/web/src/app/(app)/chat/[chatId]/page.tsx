'use client';

import { useParams } from 'next/navigation';
import { ChatView } from '../../../../features/chat/chat-view';

/** One chat. The id comes from the path. */
export default function ChatPage() {
  const params = useParams<{ chatId: string }>();
  return <ChatView key={params.chatId} chatId={params.chatId} />;
}
