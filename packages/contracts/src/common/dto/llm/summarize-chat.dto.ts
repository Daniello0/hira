import type { PromptTurn } from './understand.dto';

/** Body of `POST /internal/v1/summarize-chat`. The previous summary is rewritten, not appended. */
export interface SummarizeChatRequest {
  previousSummary: string | null;
  messages: PromptTurn[];
}

/** Four-block chat summary stored on `chats.summary`. */
export interface SummarizeChatResponse {
  summary: string;
}
