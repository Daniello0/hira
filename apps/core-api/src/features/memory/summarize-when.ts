import { WORKING_WINDOW_SIZE } from '../chat/chat.constants';
import { SUMMARY_EVERY_MESSAGES } from './memory.constants';

/** True when the chat is past the window and the count lands on the summary interval. */
export function shouldSummarize(messageCount: number): boolean {
  return messageCount > WORKING_WINDOW_SIZE && messageCount % SUMMARY_EVERY_MESSAGES === 0;
}

/** Messages that no longer fit in the working window, oldest first. */
export function outsideWindow<T>(messages: readonly T[]): T[] {
  if (messages.length <= WORKING_WINDOW_SIZE) return [];
  return messages.slice(0, messages.length - WORKING_WINDOW_SIZE);
}
