import type { ChatSummary } from '@hira/contracts';
import { deleteChat, patchChat } from './chat-api';
import { useChatList } from './chat-list.store';

type OnError = (value: string | null) => void;

/** Renames a chat. An empty or unchanged title does nothing. */
export async function renameChat(chat: ChatSummary, title: string, onError: OnError): Promise<void> {
  const next = title.trim();
  if (next.length === 0 || next === (chat.title ?? '')) return;
  const updated = await guarded(() => patchChat(chat.id, { title: next }));
  onError(updated === null ? 'Could not rename the chat' : null);
  if (updated !== null) useChatList.getState().replace(updated);
}

/** Archives or restores a chat. `apply` holds the list change back, for a row that animates out first. */
export async function setChatArchived(chat: ChatSummary, isArchived: boolean, onError: OnError, apply: (change: () => void) => void = (change) => change()): Promise<void> {
  const updated = await guarded(() => patchChat(chat.id, { isArchived }));
  onError(updated === null ? `Could not ${isArchived ? 'archive' : 'restore'} the chat` : null);
  if (updated !== null) apply(() => useChatList.getState().replace(updated));
}

/** Deletes on the server. The caller removes the row after its exit animation. */
export async function deleteChatOnServer(chatId: string, onError: OnError): Promise<boolean> {
  const ok = (await guarded(() => deleteChat(chatId))) === true;
  onError(ok ? null : 'Could not delete the chat');
  return ok;
}

async function guarded<T>(action: () => Promise<T>): Promise<T | null> {
  try {
    return await action();
  } catch {
    return null;
  }
}
