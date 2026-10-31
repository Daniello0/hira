import type { ChatSummary } from '@hira/contracts';
import { coreFetch } from '../../common/api/core-api';

/** Moves the guest chat into the account. A failure never stops the sign-in. */
async function claimGuestChat(token: string): Promise<ChatSummary | null> {
  try {
    const response = await coreFetch('/api/v1/chats/claim-guest', { method: 'POST' }, token);
    if (!response.ok) return null;
    return ((await response.json()) as { chat: ChatSummary | null }).chat;
  } catch {
    return null;
  }
}

/** Where a fresh sign-in lands: the chat it brought along, or the empty home screen. */
export async function accountLanding(token: string): Promise<string> {
  const chat = await claimGuestChat(token);
  return chat === null ? '/chat' : `/chat/${chat.id}`;
}
