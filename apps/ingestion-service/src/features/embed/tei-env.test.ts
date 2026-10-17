import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ingestion embed env', () => {
  const compose = readFileSync(
    path.resolve(__dirname, '../../../../../docker-compose.yml'),
    'utf8',
  );

  it('points ingestion at the encoder and llm-service, not the reranker', () => {
    const block = serviceBlock(compose, 'ingestion-service');
    expect(block).toContain('TEI_EMBED_URL: http://tei:80');
    expect(block).toContain('LLM_SERVICE_URL: http://llm-service:4002');
    expect(block).not.toContain('TEI_RERANK_URL');
  });
});

function serviceBlock(compose: string, name: string): string {
  const start = compose.indexOf(`\n  ${name}:\n`);
  if (start < 0) throw new Error(`service ${name} is missing`);
  const rest = compose.slice(start + 1);
  const next = rest.slice(1).search(/\n  [a-z0-9-]+:\n/);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
