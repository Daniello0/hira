import { CHARS_PER_TOKEN } from '../search/search.constants';

/** POSTs one `/rerank` body. A transport error rejects. */
export interface RerankPost {
  post(url: string, body: unknown, timeoutMs: number): Promise<unknown>;
}

/** Estimated tokens of a string, `ceil(length / 4)`. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Splits texts so one call stays inside the token arena.
 * Stub keeps a single batch.
 */
export function packRerankBatches(_query: string, texts: readonly string[]): string[][] {
  if (texts.length === 0) return [];
  return [[...texts]];
}

/**
 * Scores texts with `/rerank`. A bad payload rejects the whole window.
 * Stub rejects.
 */
export async function rerankTexts(
  _post: RerankPost,
  _baseUrl: string,
  _query: string,
  _texts: readonly string[],
): Promise<number[]> {
  return [];
}
