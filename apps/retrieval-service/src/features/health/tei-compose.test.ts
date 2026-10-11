import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const composePath = path.resolve(__dirname, '../../../../../docker-compose.yml');

describe('tei compose runtime', () => {
  const compose = readFileSync(composePath, 'utf8');

  it('keeps the production encoder and reranker', () => {
    expect(compose).toContain("'BAAI/bge-m3'");
    expect(compose).toContain("'BAAI/bge-reranker-v2-m3'");
  });

  it('waits until each TEI process answers /health before retrieval starts', () => {
    expect(compose).toContain('http://127.0.0.1:80/health');
    expect(compose).toContain('start_period: 600s');
    expect(compose).not.toContain('condition: service_started');
  });

  it('caps the token arena at the model context so warmup fits in memory', () => {
    expect(compose).toContain("'--max-batch-tokens'");
    expect(compose).toContain("'1024'");
  });
});
