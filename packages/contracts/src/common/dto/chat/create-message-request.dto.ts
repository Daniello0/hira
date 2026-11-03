import type { MessageAttachment } from '../../attachments/message-attachments';

/** Body of `POST /api/v1/chats/{chatId}/messages`. */
export interface CreateMessageRequest {
  content: string;
  /** Files read by `POST /api/v1/documents/read`; they are stored after `content`. */
  attachments?: MessageAttachment[];
  useMemory?: boolean;
  /** `false` hides foreign remote vacancies for this turn (Q30). */
  includeForeignRemote?: boolean;
}
