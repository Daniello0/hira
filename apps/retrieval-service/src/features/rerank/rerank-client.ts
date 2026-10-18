import { CHARS_PER_TOKEN, RERANK_TIMEOUT_MS, RERANK_TOKEN_ARENA } from '../search/search.constants';

/** POSTs one `/rerank` body. A transport error rejects. */
export interface RerankPost {
  post(url: string, body: unknown, timeoutMs: number): Promise<unknown>;
}

/** The reranker answered without a finite score for every text. */
export class RerankError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RerankError';
  }
}

/** Estimated tokens of a string, `ceil(length / 4)`. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** Splits texts so one call stays inside the token arena. */
export function packRerankBatches(query: string, texts: readonly string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let used = estimateTokens(query);
  for (const text of texts) ({ current, used } = pushText(batches, current, used, query, text));
  if (current.length > 0) batches.push(current);
  return batches;
}

/** Scores texts with `/rerank`. A bad payload rejects the whole window. */
export async function rerankTexts(
  post: RerankPost,
  baseUrl: string,
  query: string,
  texts: readonly string[],
): Promise<number[]> {
  const scores: number[] = [];
  for (const batch of packRerankBatches(query, texts))
    scores.push(...(await scoreBatch(post, baseUrl, query, batch)));
  return scores;
}

async function scoreBatch(
  post: RerankPost,
  baseUrl: string,
  query: string,
  texts: readonly string[],
): Promise<number[]> {
  const body = await post.post(
    endpoint(baseUrl),
    { query, texts: [...texts], truncate: true },
    RERANK_TIMEOUT_MS,
  );
  return readScores(body, texts.length);
}

function pushText(
  batches: string[][],
  current: string[],
  used: number,
  query: string,
  text: string,
): { current: string[]; used: number } {
  const tokens = estimateTokens(text);
  if (current.length > 0 && used + tokens > RERANK_TOKEN_ARENA) {
    batches.push(current);
    return { current: [text], used: estimateTokens(query) + tokens };
  }
  return { current: [...current, text], used: used + tokens };
}

function readScores(body: unknown, count: number): number[] {
  if (!Array.isArray(body) || body.length !== count)
    throw new RerankError('rerank score is missing');
  const scores = Array.from({ length: count }, () => Number.NaN);
  body.forEach((item, position) => placeScore(scores, item, position));
  if (scores.some((score) => !Number.isFinite(score)))
    throw new RerankError('rerank score is missing');
  return scores;
}

function placeScore(scores: number[], item: unknown, position: number): void {
  const score = finiteScore(item);
  if (score === null) return;
  const index = scoreIndex(item, position);
  if (index >= 0 && index < scores.length) scores[index] = score;
}

function finiteScore(item: unknown): number | null {
  if (item === null || typeof item !== 'object' || !('score' in item)) return null;
  return typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : null;
}

function scoreIndex(item: unknown, position: number): number {
  if (
    item !== null &&
    typeof item === 'object' &&
    'index' in item &&
    typeof item.index === 'number'
  )
    return item.index;
  return position;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/rerank`;
}
