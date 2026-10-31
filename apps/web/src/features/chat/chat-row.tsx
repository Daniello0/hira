'use client';

import type { ChatSummary } from '@hira/contracts';
import { Ellipsis } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertText } from '../../common/components/feedback';
import { IconButton } from '../../common/components/icon-button';
import { useLeaving } from '../../common/hooks/use-leaving';
import { deleteChatOnServer, renameChat } from './chat-actions';
import { ChatActionsMenu } from './chat-actions-menu';
import { useChatList } from './chat-list.store';

/** One sidebar chat. The `…` menu appears on hover and always on touch screens. */
export function ChatRow({ chat }: { chat: ChatSummary }) {
  const pathname = usePathname();
  const router = useRouter();
  const selected = pathname === `/chat/${chat.id}`;
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { leaving, leave } = useLeaving();
  const onDelete = () => void removeChat(chat.id, selected, router, leave, setError);
  return (
    <li data-leaving={leaving} className="motion-row motion-enter">
      {editing ? (
        <RenameField chat={chat} onDone={() => setEditing(false)} onError={setError} />
      ) : (
        <div className={`group relative flex h-row items-center rounded-row transition-colors hover:bg-hover ${selected ? 'bg-hover' : ''}`}>
          <Link className="min-w-0 flex-1 truncate px-2 py-row-y text-sm text-ink-row" aria-current={selected ? 'page' : undefined} href={`/chat/${chat.id}`}>{chat.title ?? 'New chat'}</Link>
          <ChatActionsMenu
            chat={chat}
            onRename={() => setEditing(true)}
            onDelete={onDelete}
            onError={setError}
            trigger={
              <IconButton label="Chat actions" tooltip={false} shape="action" className="md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[state=open]:opacity-100">
                <Ellipsis size={18} aria-hidden="true" />
              </IconButton>
            }
          />
        </div>
      )}
      {error !== null ? <AlertText className="px-2 pb-1 text-xs">{error}</AlertText> : null}
    </li>
  );
}

function RenameField({ chat, onDone, onError }: { chat: ChatSummary; onDone: () => void; onError: (value: string | null) => void }) {
  const [title, setTitle] = useState(chat.title ?? '');
  const commit = () => void renameChat(chat, title, onError).finally(onDone);
  return (
    <input
      aria-label="Chat name"
      autoFocus
      className="h-row w-full rounded-row border border-accent-focus bg-transparent px-2 text-sm text-ink outline-none"
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

/** The row leaves only after the server agreed; a failure keeps it and shows why. */
async function removeChat(chatId: string, selected: boolean, router: ReturnType<typeof useRouter>, leave: (remove: () => void) => void, onError: (value: string | null) => void): Promise<void> {
  if (!(await deleteChatOnServer(chatId, onError))) return;
  if (selected) router.push('/chat');
  leave(() => useChatList.getState().remove(chatId));
}
