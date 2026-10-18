import { EMBEDDING_WIDTH } from '../search/search.constants';

export class EmbedQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbedQueryError';
  }
}

export interface EmbedPost {
  post(url: string, body: unknown): Promise<unknown>;
}

/** Encodes one query with the same `/embed` body the indexer uses. No query prefix. */
export async function embedQuery(
  post: EmbedPost,
  baseUrl: string,
  text: string,
): Promise<number[]> {
  const rows = await embedTexts(post, baseUrl, [text]);
  const row = rows[0];
  if (row === undefined) throw new EmbedQueryError('embed response is not a batch');
  return row;
}

/** Encodes several surfaces in one `/embed` call. Each row must be the BGE-M3 width. */
export async function embedTexts(
  post: EmbedPost,
  baseUrl: string,
  texts: readonly string[],
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const body = await post.post(endpoint(baseUrl), { inputs: [...texts], truncate: true });
  return readBatch(body, texts.length);
}

/** pgvector text literal. A short vector is refused before it reaches SQL. */
export function vectorLiteral(values: readonly number[]): string {
  return `[${requireWidth(values).join(',')}]`;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/embed`;
}

function readBatch(body: unknown, count: number): number[][] {
  if (!Array.isArray(body) || body.length !== count)
    throw new EmbedQueryError('embed response is not a batch');
  return body.map((row) => {
    if (!Array.isArray(row)) throw new EmbedQueryError('embed response is not a batch');
    return requireWidth(row);
  });
}

function requireWidth(row: readonly unknown[]): number[] {
  const values = row.filter(
    (item): item is number => typeof item === 'number' && Number.isFinite(item),
  );
  if (values.length !== EMBEDDING_WIDTH || values.length !== row.length) {
    throw new EmbedQueryError(`embedding width must be ${EMBEDDING_WIDTH}`);
  }
  return values;
}
