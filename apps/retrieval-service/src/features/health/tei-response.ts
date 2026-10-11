/** Width of the first embedding row. A non-array body is not a TEI `/embed` payload. */
export function readEmbeddingDimension(body: unknown): number | null {
  if (!Array.isArray(body) || !Array.isArray(body[0])) return null;
  const row = body[0];
  if (row.some((item) => typeof item !== 'number')) return null;
  return row.length;
}

/** True when TEI `/rerank` returned at least one finite score. */
export function hasRerankScore(body: unknown): boolean {
  if (!Array.isArray(body)) return false;
  return body.some((item) => finiteScore(item));
}

function finiteScore(item: unknown): boolean {
  if (item === null || typeof item !== 'object' || !('score' in item)) return false;
  const score = item.score;
  return typeof score === 'number' && Number.isFinite(score);
}
