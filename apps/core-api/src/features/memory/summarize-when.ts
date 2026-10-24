import { WORKING_WINDOW_SIZE } from '../chat/chat.constants';
import { SUMMARY_DELTA_MESSAGES, SUMMARY_EVERY_MESSAGES, SUMMARY_SOURCE_LIMIT } from './memory.constants';

/**
 * True when the chat is past the window and this turn crossed a multiple of the summary interval.
 * Crossing, not landing, so a turn that stored one message instead of two cannot skip a rebuild.
 */
export function shouldSummarize(previousCount: number, messageCount: number): boolean {
  if (messageCount <= WORKING_WINDOW_SIZE || messageCount <= previousCount) return false;
  return Math.floor(messageCount / SUMMARY_EVERY_MESSAGES) > Math.floor(previousCount / SUMMARY_EVERY_MESSAGES);
}

/** Messages that no longer fit in the working window, oldest first. */
export function outsideWindow<T>(messages: readonly T[]): T[] {
  if (messages.length <= WORKING_WINDOW_SIZE) return [];
  return messages.slice(0, messages.length - WORKING_WINDOW_SIZE);
}

/**
 * Displaced messages the summary has not seen yet.
 * With a previous summary only the last interval (plus overlap) is new; the first summary gets a capped tail.
 */
export function summarySource<T>(messages: readonly T[], previousSummary: string | null): T[] {
  const displaced = outsideWindow(messages);
  const limit = previousSummary === null ? SUMMARY_SOURCE_LIMIT : SUMMARY_DELTA_MESSAGES;
  return displaced.slice(-limit);
}
