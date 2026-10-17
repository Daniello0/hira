/** BGE-M3 dense width. A shorter vector is not written. */
export const EMBEDDING_WIDTH = 1024;

/** The indexer refuses a TEI payload that is not a batch of full vectors. */
export class EmbedShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbedShapeError';
  }
}

export interface EmbedPost {
  post(url: string, body: unknown): Promise<unknown>;
}

/** Splits items into fixed-size batches. The last batch may be shorter. */
export function chunkItems<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/** Reads a TEI `/embed` body. One short row rejects the whole batch. */
export function parseEmbedResponse(body: unknown, expectedWidth: number): number[][] {
  if (!Array.isArray(body)) throw new EmbedShapeError('embed response is not a batch');
  return body.map((row) => readRow(row, expectedWidth));
}

/** pgvector text literal for one full embedding. */
export function vectorLiteral(values: readonly number[]): string {
  return `[${readRow(values, EMBEDDING_WIDTH).join(',')}]`;
}

/** POSTs `{ inputs, truncate: true }` and returns the vectors. Transport errors propagate. */
export async function requestEmbeddings(
  post: EmbedPost,
  baseUrl: string,
  inputs: readonly string[],
): Promise<number[][]> {
  const body = await post.post(endpoint(baseUrl), { inputs, truncate: true });
  return parseEmbedResponse(body, EMBEDDING_WIDTH);
}

function readRow(row: unknown, expectedWidth: number): number[] {
  if (!Array.isArray(row) || row.length !== expectedWidth) {
    throw new EmbedShapeError(`embedding width must be ${expectedWidth}`);
  }
  if (row.some((item) => typeof item !== 'number' || !Number.isFinite(item))) {
    throw new EmbedShapeError('embedding contains a non-finite component');
  }
  return row;
}

function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, '')}/embed`;
}
