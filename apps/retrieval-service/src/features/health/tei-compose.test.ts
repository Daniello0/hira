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

  it('starts retrieval-service only after both TEI /health checks', () => {
    const retrieval = serviceBlock(compose, 'retrieval-service');
    expect(retrieval).toMatch(/tei:\n\s+condition: service_healthy/);
    expect(retrieval).toMatch(/tei-rerank:\n\s+condition: service_healthy/);
    expect(retrieval).not.toContain('condition: service_started');
    expect(compose).toContain('http://127.0.0.1:80/health');
    expect(compose).toContain('start_period: 600s');
  });

  it('sets the token arena to the model context of 8192', () => {
    expect(compose.match(/'--max-batch-tokens', '8192'/g)).toHaveLength(2);
    expect(compose).not.toContain("'1024'");
  });
});

function serviceBlock(compose: string, name: string): string {
  const start = compose.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`service ${name} is missing`);
  const rest = compose.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z0-9-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
