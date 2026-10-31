import type { ChatDetail, ChatMessageView, ChatPage, ChatSummary, UpdateChatRequest } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';
import { notifyOtherTabs } from '../../common/data/data-version.store';

/** A chat that could not be opened: gone, or the request failed. */
export type ChatLoad = { kind: 'ok'; detail: ChatDetail } | { kind: 'not-found' } | { kind: 'failed' };

/** Lists chats. A demo cookie receives its one chat. */
export async function fetchChats(cursor?: string): Promise<ChatPage<ChatSummary> | null> {
  return readJson<ChatPage<ChatSummary>>(await authedFetch(`/api/v1/chats${query(cursor)}`));
}

/** One page of chats whose title contains the text. `null` when the request failed. */
export async function searchChats(text: string, cursor?: string): Promise<ChatPage<ChatSummary> | null> {
  const position = cursor === undefined ? '' : `&cursor=${encodeURIComponent(cursor)}`;
  return readJson<ChatPage<ChatSummary>>(await authedFetch(`/api/v1/chats?q=${encodeURIComponent(text)}${position}`));
}

/** Creates an empty chat. `limited` is the demo one-chat cap. */
export async function createChat(): Promise<{ chat: ChatSummary | null; limited: boolean }> {
  const response = await authedFetch('/api/v1/chats', { method: 'POST' });
  if (response.status === 429) return { chat: null, limited: true };
  return { chat: await readJson<ChatSummary>(response), limited: false };
}

/** Chat plus the newest page of messages, or why it could not be opened. */
export async function loadChat(chatId: string): Promise<ChatLoad> {
  try {
    const response = await authedFetch(`/api/v1/chats/${chatId}`);
    if (response.status === 404 || response.status === 403) return { kind: 'not-found' };
    const detail = await readJson<ChatDetail>(response);
    return detail === null ? { kind: 'failed' } : { kind: 'ok', detail };
  } catch {
    return { kind: 'failed' };
  }
}

/** Chat plus the newest page of messages. */
export async function fetchChat(chatId: string): Promise<ChatDetail | null> {
  const loaded = await loadChat(chatId);
  return loaded.kind === 'ok' ? loaded.detail : null;
}

/** Older messages, oldest first inside the page. */
export async function fetchOlder(chatId: string, cursor: string): Promise<ChatPage<ChatMessageView> | null> {
  return readJson<ChatPage<ChatMessageView>>(await authedFetch(`/api/v1/chats/${chatId}/messages${query(cursor)}`));
}

/** Renames, archives, or restores. */
export async function patchChat(chatId: string, body: UpdateChatRequest): Promise<ChatSummary | null> {
  const updated = await readJson<ChatSummary>(await authedFetch(`/api/v1/chats/${chatId}`, jsonRequest('PATCH', body)));
  if (updated !== null) notifyOtherTabs('chats');
  return updated;
}

/** Deletes a chat. */
export async function deleteChat(chatId: string): Promise<boolean> {
  const response = await authedFetch(`/api/v1/chats/${chatId}`, { method: 'DELETE' });
  if (response.ok) notifyOtherTabs('chats');
  return response.ok;
}

function query(cursor?: string): string {
  if (cursor === undefined) return '';
  return `?cursor=${encodeURIComponent(cursor)}`;
}
