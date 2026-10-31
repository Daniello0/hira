import { SessionStatus } from '../auth/session-status';
import { MESSAGE_TOO_LONG } from './chat.constants';
import { rejectDraft } from './send-decision';
import { StreamPhase } from './stream-phase';

/** Options the home composer chose for the first message. */
export interface PendingSend {
  useMemory: boolean;
}

/** Why a first message did not start a chat. The text stays in the composer in every case. */
export type StartChatResult =
  | { kind: 'started'; chatId: string }
  | { kind: 'ignored' }
  | { kind: 'limited' }
  | { kind: 'failed'; message: string };

export const START_CHAT_FAILED = 'Could not create a chat';
export const START_CHAT_UNREACHABLE = 'Could not reach Hira';

interface StartChatDeps {
  create: () => Promise<{ chat: { id: string } | null; limited: boolean }>;
}

/** Creates the chat for a first message. An empty or over-long text never reaches the API. */
export async function startChat(text: string, deps: StartChatDeps): Promise<StartChatResult> {
  const decision = rejectDraft(text, StreamPhase.Idle);
  if (decision === 'too-long') return { kind: 'failed', message: MESSAGE_TOO_LONG };
  if (decision !== 'ok') return { kind: 'ignored' };
  try {
    const created = await deps.create();
    if (created.limited) return { kind: 'limited' };
    return created.chat === null ? { kind: 'failed', message: START_CHAT_FAILED } : { kind: 'started', chatId: created.chat.id };
  } catch {
    return { kind: 'failed', message: START_CHAT_UNREACHABLE };
  }
}

const pending = new Map<string, PendingSend>();

/** Remembers that a new chat has a first message waiting to be sent. */
export function markPendingSend(chatId: string, send: PendingSend): void {
  pending.set(chatId, send);
}

/** Hands the waiting message over once, so a repeated effect cannot send it twice. */
export function takePendingSend(chatId: string): PendingSend | null {
  const send = pending.get(chatId) ?? null;
  pending.delete(chatId);
  return send;
}

/** A demo session owns one chat and reopens it. An account always gets the empty home screen. */
export function homeDestination(status: SessionStatus, chats: readonly { id: string }[]): string | null {
  if (status === SessionStatus.Account || status === SessionStatus.Unknown) return null;
  const chat = chats[0];
  return chat === undefined ? null : `/chat/${chat.id}`;
}
