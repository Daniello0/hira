import type { MessageRole } from '../../enums/message-role.enum';
import type { RetrievalDiagnostics, VacancyResult } from '../search/retrieval.dto';
import type { SearchIntent } from '../search/search-intent.dto';

/** One chat in a list or detail response. */
export interface ChatSummary {
  id: string;
  title: string | null;
  isArchived: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * One stored turn.
 * Assistant messages include the frozen ranking. User messages do not.
 */
export interface ChatMessageView {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  results?: VacancyResult[];
  /** Present on user turns after understand. The context panel reads this after reload. */
  intent?: SearchIntent;
  /** Relaxation and branch timings stored beside the user turn. */
  diagnostics?: RetrievalDiagnostics;
}

/** Cursor page. `nextCursor` is null on the last page. */
export interface ChatPage<T> {
  items: T[];
  nextCursor: string | null;
}

/** A chat plus its latest messages, oldest first. */
export interface ChatDetail {
  chat: ChatSummary;
  messages: ChatMessageView[];
  nextCursor: string | null;
}

/** Rename or archive. At least one field is required. */
export interface UpdateChatRequest {
  title?: string;
  isArchived?: boolean;
}
