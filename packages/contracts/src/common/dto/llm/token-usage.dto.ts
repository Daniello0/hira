/** Token counts reported by the language-model provider. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** Accounting block returned next to an LLM result. */
export interface LlmMeta {
  tokenUsage: TokenUsage;
}
