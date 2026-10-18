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
export async function embedQuery(post: EmbedPost, baseUrl: string, text: string): Promise<number[]> {
  const body = await post.post(endpoint(baseUrl), { inputs: [text], truncate: true });
  return readVector(body);
}

/** pgvector text literal. A short vector is refused before it reaches SQL. */
export function vectorLiteral(values: readonly number[]): string {
  return `[${requireWidth(values).join(',')}]`;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/embed`;
}

function readVector(body: unknown): number[] {
  if (!Array.isArray(body) || !Array.isArray(body[0])) {
    throw new EmbedQueryError('embed response is not a batch');
  }
  return requireWidth(body[0]);
}

function requireWidth(row: readonly unknown[]): number[] {
  const values = row.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (values.length !== EMBEDDING_WIDTH || values.length !== row.length) {
    throw new EmbedQueryError(`embedding width must be ${EMBEDDING_WIDTH}`);
  }
  return values;
}
