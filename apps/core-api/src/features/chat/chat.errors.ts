import {
  CHAT_NOT_FOUND_MESSAGE,
  DEMO_CHAT_LIMIT_MESSAGE,
  INVALID_CURSOR_MESSAGE,
  INVALID_SEARCH_MESSAGE,
  QUOTA_EXCEEDED_MESSAGE,
  SEARCH_UPSTREAM_MESSAGE,
} from './chat.constants';

/** The chat is missing or belongs to someone else. */
export class ChatNotFoundError extends Error {
  constructor() {
    super(CHAT_NOT_FOUND_MESSAGE);
    this.name = 'ChatNotFoundError';
  }
}

/** A demo session already has its one chat. */
export class DemoChatLimitError extends Error {
  constructor() {
    super(DEMO_CHAT_LIMIT_MESSAGE);
    this.name = 'DemoChatLimitError';
  }
}

/** An archived chat does not take new messages until it is restored. */
export class ArchivedChatError extends Error {
  constructor() {
    super('Archived chat does not take messages');
    this.name = 'ArchivedChatError';
  }
}

/** PATCH carried neither a title nor an archive flag. */
export class EmptyChatPatchError extends Error {
  constructor() {
    super('Chat update is empty');
    this.name = 'EmptyChatPatchError';
  }
}

/** The page cursor is not one this API issued. */
export class InvalidCursorError extends Error {
  constructor() {
    super(INVALID_CURSOR_MESSAGE);
    this.name = 'InvalidCursorError';
  }
}

/** The demo or daily search counter is spent. `retryAfterSeconds` is null for demo. */
export class QuotaDeniedError extends Error {
  constructor(readonly retryAfterSeconds: number | null) {
    super(QUOTA_EXCEEDED_MESSAGE);
    this.name = 'QuotaDeniedError';
  }
}

/** retrieval-service did not return a ranking. */
export class SearchUpstreamError extends Error {
  constructor() {
    super(SEARCH_UPSTREAM_MESSAGE);
    this.name = 'SearchUpstreamError';
  }
}

/** `POST /search` has neither a query nor an intent. */
export class InvalidSearchError extends Error {
  constructor() {
    super(INVALID_SEARCH_MESSAGE);
    this.name = 'InvalidSearchError';
  }
}
