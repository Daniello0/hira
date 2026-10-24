/** Body of `POST /api/v1/chats/{chatId}/messages`. */
export interface CreateMessageRequest {
  content: string;
  useMemory?: boolean;
  /** `false` hides foreign remote vacancies for this turn (Q30). */
  includeForeignRemote?: boolean;
}
