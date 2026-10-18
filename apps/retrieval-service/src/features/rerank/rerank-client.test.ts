import { describe, expect, it } from 'vitest';
import { RERANK_TOKEN_ARENA } from '../search/search.constants';
import { estimateTokens, packRerankBatches, rerankTexts } from './rerank-client';

describe('packRerankBatches', () => {
  it('keeps each call inside the token arena', () => {
    const query = 'q';
    const text = 'a'.repeat(4 * 3000);
    const batches = packRerankBatches(query, [text, text, text]);
    expect(batches.map((batch) => batch.length)).toEqual([2, 1]);
    for (const batch of batches) {
      const tokens =
        estimateTokens(query) + batch.reduce((sum, item) => sum + estimateTokens(item), 0);
      expect(tokens).toBeLessThanOrEqual(RERANK_TOKEN_ARENA);
    }
  });
});

describe('rerankTexts', () => {
  it('posts query, texts, and truncate, then reads finite scores', async () => {
    const seen: Array<{ url: string; body: unknown; timeoutMs: number }> = [];
    const scores = await rerankTexts(
      {
        post: async (url, body, timeoutMs) => {
          seen.push({ url, body, timeoutMs });
          return [
            { index: 1, score: 0.2 },
            { index: 0, score: 0.9 },
          ];
        },
      },
      'http://rerank:80/',
      'python',
      ['first', 'second'],
    );
    expect(seen).toEqual([
      {
        url: 'http://rerank:80/rerank',
        body: { query: 'python', texts: ['first', 'second'], truncate: true },
        timeoutMs: 120_000,
      },
    ]);
    expect(scores).toEqual([0.9, 0.2]);
  });

  it('rejects the whole window when any score is missing', async () => {
    await expect(
      rerankTexts(
        {
          post: async () => [{ index: 0, score: 0.4 }, { index: 1 }],
        },
        'http://rerank:80',
        'python',
        ['first', 'second'],
      ),
    ).rejects.toThrow(/score/);
  });
});
