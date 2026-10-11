import { describe, expect, it } from 'vitest';
import { EMBEDDING_DIMENSION } from './health.constants';
import { buildRetrievalProbes } from './build-probes';

describe('retrieval probes', () => {
  it('marks the encoder down when the vector is not 1024-dimensional', async () => {
    const probes = buildRetrievalProbes(env(), {
      post: async (url) => (url.endsWith('/embed') ? [[0.1]] : [{ index: 0, score: 1 }]),
    });
    const encoder = probes.find((probe) => probe.name === 'tei');
    const reranker = probes.find((probe) => probe.name === 'tei-rerank');
    expect(await encoder?.check()).toBe(false);
    expect(await reranker?.check()).toBe(true);
  });

  it('marks the encoder up when /embed returns 1024 floats', async () => {
    const vector = Array.from({ length: EMBEDDING_DIMENSION }, () => 0);
    const probes = buildRetrievalProbes(env(), {
      post: async (url) => (url.endsWith('/embed') ? [vector] : [{ index: 0, score: 0.5 }]),
    });
    const encoder = probes.find((probe) => probe.name === 'tei');
    expect(await encoder?.check()).toBe(true);
  });
});

function env(): NodeJS.ProcessEnv {
  return {
    DATABASE_URL: 'postgres://localhost/hira',
    TEI_EMBED_URL: 'http://tei:80',
    TEI_RERANK_URL: 'http://tei-rerank:80',
  };
}
