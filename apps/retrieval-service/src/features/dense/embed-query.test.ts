import { describe, expect, it } from 'vitest';
import { EMBEDDING_WIDTH } from '../search/search.constants';
import { EmbedQueryError, embedQuery } from './embed-query';

function row(width: number): number[] {
  return Array.from({ length: width }, () => 0.25);
}

describe('embedQuery', () => {
  it('posts the raw query with truncate and returns one full vector', async () => {
    const seen: Array<{ url: string; body: unknown }> = [];
    const vector = await embedQuery(
      {
        post: async (url, body) => {
          seen.push({ url, body });
          return [row(EMBEDDING_WIDTH)];
        },
      },
      'http://tei:80/',
      'Junior Python',
    );
    expect(seen).toEqual([
      {
        url: 'http://tei:80/embed',
        body: { inputs: ['Junior Python'], truncate: true },
      },
    ]);
    expect(vector).toHaveLength(EMBEDDING_WIDTH);
  });

  it('rejects a short vector and a transport failure', async () => {
    await expect(
      embedQuery(
        {
          post: async () => [row(3)],
        },
        'http://tei:80',
        'Python',
      ),
    ).rejects.toBeInstanceOf(EmbedQueryError);
    await expect(
      embedQuery(
        {
          post: async () => {
            throw new Error('tei down');
          },
        },
        'http://tei:80',
        'Python',
      ),
    ).rejects.toThrow('tei down');
  });
});
