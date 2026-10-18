/** Account switch for cross-chat facts. The chat window and summary ignore it. */
export interface MemorySettings {
  crossChatMemory: boolean;
}

/** Body of `PATCH /api/v1/memory/{id}`. */
export interface UpdateMemoryRequest {
  content?: string;
  isPinned?: boolean;
}
