import { MessageRole, type PromptTurn } from '@hira/contracts';
import { WORKING_WINDOW_SIZE } from './chat.constants';
import type { MessageRecord } from './chat.store';

/** Last N user and assistant turns, oldest first. The new query is sent separately. */
export function promptHistory(messages: MessageRecord[]): PromptTurn[] {
  return messages
    .filter((message) => message.role === MessageRole.User || message.role === MessageRole.Assistant)
    .slice(-WORKING_WINDOW_SIZE)
    .map((message) => ({ role: message.role, content: message.content }));
}
