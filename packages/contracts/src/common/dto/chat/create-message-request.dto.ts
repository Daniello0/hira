/** Body of `POST /api/v1/chats/{chatId}/messages`. */
export interface CreateMessageRequest {
  content: string;
  useMemory?: boolean;
}
