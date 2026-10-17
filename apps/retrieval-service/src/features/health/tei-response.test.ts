import { describe, expect, it } from 'vitest';
import { hasRerankScore, readEmbeddingDimension } from './tei-response';

describe('tei response', () => {
  it('reads the width of the first embedding row', () => {
    expect(readEmbeddingDimension([Array.from({ length: 1024 }, () => 0.1)])).toBe(1024);
    expect(readEmbeddingDimension([[0.1, 0.2]])).toBe(2);
    expect(readEmbeddingDimension({ embeddings: [[0.1]] })).toBeNull();
    expect(readEmbeddingDimension([['no']])).toBeNull();
  });

  it('accepts a finite rerank score', () => {
    expect(hasRerankScore([{ index: 0, score: 0.4 }])).toBe(true);
    expect(hasRerankScore([{ index: 0 }])).toBe(false);
    expect(hasRerankScore([{ index: 0, score: Number.NaN }])).toBe(false);
  });
});
