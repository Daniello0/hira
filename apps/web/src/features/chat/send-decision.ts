import { MessageRole, type ChatMessageView } from '@hira/contracts';

/** What to do after a send that did not finish cleanly. */
export type FailedSend = 'reload' | 'keep-draft';

/**
 * A stream that already opened must not be posted again.
 * A draft that is already the last user turn must not be posted again either.
 */
export function afterFailedSend(input: { streamOpened: boolean; draft: string; messages: readonly ChatMessageView[] }): FailedSend {
  if (input.streamOpened) return 'reload';
  const last = [...input.messages].reverse().find((item) => item.role === MessageRole.User);
  if (last?.content === input.draft) return 'reload';
  return 'keep-draft';
}

/** True when the reloaded chat stopped on the user turn. */
export function answerInterrupted(messages: readonly ChatMessageView[]): boolean {
  return messages.at(-1)?.role === MessageRole.User;
}
