import { requestEmbeddings, vectorLiteral, type EmbedPost } from './embed-client';

/** Embeds one skill surface. A failed encoder leaves the cascade on exact, alias, and trigram. */
export async function surfaceVector(
  post: EmbedPost,
  baseUrl: string,
  surface: string,
): Promise<string | null> {
  try {
    const vectors = await requestEmbeddings(post, baseUrl, [surface]);
    const row = vectors[0];
    if (row === undefined) return null;
    return vectorLiteral(row);
  } catch {
    return null;
  }
}
