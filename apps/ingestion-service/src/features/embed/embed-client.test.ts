import { describe, expect, it } from 'vitest';
import {
  EmbedShapeError,
  chunkItems,
  parseEmbedResponse,
  requestEmbeddings,
  vectorLiteral,
} from './embed-client';

const WIDTH = 1024;

function row(width: number, value = 0.1): number[] {
  return Array.from({ length: width }, () => value);
}

describe('embed client', () => {
  it('splits work into batches of 32', () => {
    expect(chunkItems([], 32)).toEqual([]);
    expect(chunkItems([1, 2, 3], 32)).toEqual([[1, 2, 3]]);
    expect(
      chunkItems(
        Array.from({ length: 33 }, (_, index) => index),
        32,
      ),
    ).toEqual([Array.from({ length: 32 }, (_, index) => index), [32]]);
  });

  it('reads a batch of 1024-wide vectors and formats one literal', () => {
    const vectors = parseEmbedResponse([row(WIDTH), row(WIDTH, 0.2)], WIDTH);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(WIDTH);
    expect(vectorLiteral(vectors[0] ?? [])).toBe(`[${row(WIDTH).join(',')}]`);
  });

  it('rejects a short vector, a non-array body, and a non-finite component', () => {
    expect(() => parseEmbedResponse([row(3)], WIDTH)).toThrow(EmbedShapeError);
    expect(() => parseEmbedResponse({ embeddings: [row(WIDTH)] }, WIDTH)).toThrow(EmbedShapeError);
    const broken = row(WIDTH);
    broken[0] = Number.NaN;
    expect(() => parseEmbedResponse([broken], WIDTH)).toThrow(EmbedShapeError);
    expect(() => vectorLiteral(row(3))).toThrow(EmbedShapeError);
  });

  it('posts truncate to /embed and does not turn a transport error into an empty vector', async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    const vectors = await requestEmbeddings(
      {
        post: async (url, body) => {
          seen.push({ url, body });
          return [row(WIDTH)];
        },
      },
      'http://tei:80/',
      ['Python'],
    );
    expect(seen).toEqual([
      { url: 'http://tei:80/embed', body: { inputs: ['Python'], truncate: true } },
    ]);
    expect(vectors[0]).toHaveLength(WIDTH);
    await expect(
      requestEmbeddings(
        {
          post: async () => {
            throw new Error('tei down');
          },
        },
        'http://tei:80',
        ['Python'],
      ),
    ).rejects.toThrow('tei down');
  });
});
