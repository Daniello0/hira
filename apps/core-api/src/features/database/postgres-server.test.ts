import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const composePath = path.resolve(__dirname, '../../../../../docker-compose.yml');

describe('postgres server settings', () => {
  const compose = readFileSync(composePath, 'utf8');

  it('preloads pg_textsearch and enables iterative HNSW scans for every connection', () => {
    expect(compose).toContain('shared_preload_libraries=pg_textsearch');
    expect(compose).toContain('hnsw.iterative_scan=relaxed_order');
  });

  it('runs migrations once, before any service that reads the database', () => {
    expect(compose).toContain('migrate:');
    expect(compose).toContain('service_completed_successfully');
    expect(compose).toContain('node dist/migrate.js');
  });
});
