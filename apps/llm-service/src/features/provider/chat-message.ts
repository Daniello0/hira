/** One chat message in the provider's lowercase role vocabulary. */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
