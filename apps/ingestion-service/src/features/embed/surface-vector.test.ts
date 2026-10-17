import { describe, expect, it } from 'vitest';
import { EMBEDDING_WIDTH } from './embed-client';
import { surfaceVector } from './surface-vector';

const row = Array.from({ length: EMBEDDING_WIDTH }, () => 0.25);

describe('surfaceVector', () => {
  it('returns a pgvector literal for one embedding', async () => {
    const literal = await surfaceVector(
      {
        post: async () => [row],
      },
      'http://tei:80',
      'Python',
    );
    expect(literal).toBe(`[${row.join(',')}]`);
  });

  it('returns null when the encoder fails so linking can continue', async () => {
    const literal = await surfaceVector(
      {
        post: async () => {
          throw new Error('tei down');
        },
      },
      'http://tei:80',
      'Python',
    );
    expect(literal).toBeNull();
  });
});
