import { EMBEDDING_DIMENSION } from '../database/database.constants';

export interface EmbedPost {
  post(url: string, body: unknown): Promise<unknown>;
}

/** Encodes one text with TEI. A failure or a short vector becomes null so the turn can continue. */
export async function embedText(post: EmbedPost, baseUrl: string, text: string): Promise<number[] | null> {
  if (baseUrl.trim().length === 0) return null;
  try {
    const body = await post.post(`${baseUrl.replace(/\/$/, '')}/embed`, { inputs: [text], truncate: true });
    return readVector(body);
  } catch {
    return null;
  }
}

function readVector(body: unknown): number[] | null {
  if (!Array.isArray(body) || !Array.isArray(body[0])) return null;
  const row = body[0].filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  if (row.length !== EMBEDDING_DIMENSION || row.length !== body[0].length) return null;
  return row;
}
