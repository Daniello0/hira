/** Dialogue window from Wiki/07 §3.1. Summary rebuild stays on stage 12. */
export const WORKING_WINDOW_SIZE = 10;

export const CHAT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
export const MAX_MESSAGE_LENGTH = 4_000;
export const MAX_CHAT_TITLE_LENGTH = 256;
export const DEMO_CHAT_LIMIT = 1;

/** First message becomes the title until the user renames the chat. An emoji is not split. */
export function titleFromFirstMessage(content: string): string {
  return Array.from(content).slice(0, MAX_CHAT_TITLE_LENGTH).join('');
}

export const CHAT_NOT_FOUND = 'CHAT_NOT_FOUND';
export const CHAT_NOT_FOUND_MESSAGE = 'Chat was not found';
export const DEMO_CHAT_LIMIT_MESSAGE = 'Demo sessions can keep one chat';
export const QUOTA_EXCEEDED_MESSAGE = 'Search quota exceeded';
export const SEARCH_UPSTREAM_UNAVAILABLE = 'SEARCH_UPSTREAM_UNAVAILABLE';
export const SEARCH_UPSTREAM_MESSAGE = 'Search is temporarily unavailable';
export const INVALID_CURSOR_MESSAGE = 'Page cursor is invalid';
export const INVALID_SEARCH_MESSAGE = 'Search request is invalid';

export const SSE_EVENT = {
  userMessage: 'user-message',
  intent: 'intent',
  results: 'results',
  /** `DocumentDraftDto` after the tokens of a `DRAFT_DOCUMENT` turn. */
  documentDraft: 'document-draft',
  token: 'token',
  assistantMessage: 'assistant-message',
  done: 'done',
  error: 'error',
} as const;
