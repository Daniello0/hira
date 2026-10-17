import { createServer, type Server } from 'node:http';
import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSION } from './health.constants';
import { postJson, probeEmbedding, probeRerank, type JsonPost } from './probe-tei';

const VECTOR = [Array.from({ length: EMBEDDING_DIMENSION }, () => 0.01)];

describe('tei model probes', () => {
  it('accepts /embed only when the vector is 1024-dimensional', async () => {
    const seen: string[] = [];
    const post = record(seen, VECTOR);
    await expect(probeEmbedding(post, 'http://tei:80/')).resolves.toBe(true);
    await expect(probeEmbedding(record([], [[0.1]]), 'http://tei:80')).resolves.toBe(false);
    await expect(probeEmbedding(post, ' ')).resolves.toBe(false);
    expect(seen).toEqual(['http://tei:80/embed']);
  });

  it('accepts /rerank only when a score comes back', async () => {
    const seen: string[] = [];
    await expect(
      probeRerank(record(seen, [{ index: 0, score: 0.2 }]), 'http://rerank'),
    ).resolves.toBe(true);
    await expect(probeRerank(record([], [{ index: 0 }]), 'http://rerank')).resolves.toBe(false);
    expect(seen).toEqual(['http://rerank/rerank']);
  });

  it('posts JSON and returns the parsed body', async () => {
    const server = await listen();
    const port = portOf(server);
    await expect(
      postJson(`http://127.0.0.1:${port}/embed`, { inputs: 'x' }, 1000),
    ).resolves.toEqual([[1, 2]]);
    await close(server);
  });
});

function record(seen: string[], body: unknown): JsonPost {
  return {
    post: (url) => {
      seen.push(url);
      return Promise.resolve(body);
    },
  };
}

function listen(): Promise<Server> {
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify([[1, 2]]));
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function portOf(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('expected a TCP address');
  return address.port;
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
