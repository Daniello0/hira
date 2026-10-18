/** Cosine similarity in the range -1..1. Different lengths or a zero vector score 0. */
export function cosineSimilarity(left: readonly number[], right: readonly number[]): number {
  if (left.length === 0 || left.length !== right.length) return 0;
  const scale = magnitude(left) * magnitude(right);
  if (scale === 0) return 0;
  return dot(left, right) / scale;
}

function dot(left: readonly number[], right: readonly number[]): number {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function magnitude(values: readonly number[]): number {
  return Math.sqrt(dot(values, values));
}
