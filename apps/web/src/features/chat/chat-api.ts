import type { ChatDetail, ChatMessageView, ChatPage, ChatSummary } from '@hira/contracts';
import { coreFetch } from '../../common/api/core-api';

/** Lists chats. A demo cookie receives its one chat. */
export async function fetchChats(token: string | null, cursor?: string): Promise<ChatPage<ChatSummary> | null> {
  const response = await coreFetch(`/api/v1/chats${query(cursor)}`, { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as ChatPage<ChatSummary>;
}

/** Creates an empty chat. `limited` is the demo one-chat cap. */
export async function createChat(token: string | null): Promise<{ chat: ChatSummary | null; limited: boolean }> {
  const response = await coreFetch('/api/v1/chats', { method: 'POST' }, token);
  if (response.status === 429) return { chat: null, limited: true };
  if (!response.ok) return { chat: null, limited: false };
  return { chat: (await response.json()) as ChatSummary, limited: false };
}

/** Chat plus the newest page of messages. */
export async function fetchChat(token: string | null, chatId: string): Promise<ChatDetail | null> {
  const response = await coreFetch(`/api/v1/chats/${chatId}`, { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as ChatDetail;
}

/** Older messages, oldest first inside the page. */
export async function fetchOlder(token: string | null, chatId: string, cursor: string): Promise<ChatPage<ChatMessageView> | null> {
  const response = await coreFetch(`/api/v1/chats/${chatId}/messages${query(cursor)}`, { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as ChatPage<ChatMessageView>;
}

/** Renames or archives. */
export async function patchChat(token: string | null, chatId: string, body: { title?: string; isArchived?: boolean }): Promise<ChatSummary | null> {
  const response = await coreFetch(`/api/v1/chats/${chatId}`, json('PATCH', body), token);
  if (!response.ok) return null;
  return (await response.json()) as ChatSummary;
}

/** Deletes a chat. */
export async function deleteChat(token: string | null, chatId: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/chats/${chatId}`, { method: 'DELETE' }, token);
  return response.ok;
}

function query(cursor?: string): string {
  if (cursor === undefined) return '';
  return `?cursor=${encodeURIComponent(cursor)}`;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
