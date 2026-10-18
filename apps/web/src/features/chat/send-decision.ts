import { MessageRole, type ChatMessageView } from '@hira/contracts';
import { INTERRUPTED_ANSWER, MAX_MESSAGE_LENGTH } from './chat.constants';
import { canSubmit, emptyTurn, type LiveTurn } from './reduce-chat-event';
import { StreamPhase } from './stream-phase';

/** What to do after a send that did not finish cleanly. */
export type FailedSend = 'reload' | 'keep-draft';

/** Why the composer did not send. */
export type DraftDecision = 'ok' | 'busy' | 'empty' | 'too-long';

/**
 * A stream that already opened must not be posted again.
 * A draft that is already the last user turn must not be posted again either.
 */
export function afterFailedSend(input: {
  streamOpened: boolean;
  draft: string;
  messages: readonly ChatMessageView[];
}): FailedSend {
  if (input.streamOpened) return 'reload';
  const last = [...input.messages].reverse().find((item) => item.role === MessageRole.User);
  if (last?.content === input.draft) return 'reload';
  return 'keep-draft';
}

/** True when the reloaded chat stopped on the user turn. */
export function answerInterrupted(messages: readonly ChatMessageView[]): boolean {
  return messages.at(-1)?.role === MessageRole.User;
}

/** A history response that arrives during a turn must not replace it. */
export function shouldApplyHistory(phase: StreamPhase): boolean {
  return phase === StreamPhase.Idle;
}

/** Older messages go first. Loading the same page twice does not duplicate rows. */
export function prependMessages(
  current: readonly ChatMessageView[],
  older: readonly ChatMessageView[],
): ChatMessageView[] {
  const seen = new Set(current.map((item) => item.id));
  const fresh = older.filter((item) => !seen.has(item.id));
  return [...fresh, ...current];
}

/** Empty and over-long drafts stay in the browser. */
export function rejectDraft(draft: string, phase: StreamPhase): DraftDecision {
  if (!canSubmit(phase)) return 'busy';
  const text = draft.trim();
  if (text.length === 0) return 'empty';
  if (text.length > MAX_MESSAGE_LENGTH) return 'too-long';
  return 'ok';
}

/** Chat restored after a dropped stream. */
export function reloadedTurn(messages: readonly ChatMessageView[]): LiveTurn {
  const notice = answerInterrupted(messages) ? INTERRUPTED_ANSWER : null;
  return { ...emptyTurn(messages), notice };
}

/** The composer has to accept another try when reload fails. */
export function releaseTurn(state: LiveTurn, notice: string): LiveTurn {
  return { ...state, phase: StreamPhase.Idle, notice };
}
