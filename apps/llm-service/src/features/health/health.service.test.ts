import { describe, expect, it } from 'vitest';
import { DependencyState } from './health.types';
import { collectReadiness, liveness } from './health.service';

describe('llm health', () => {
  it('reports liveness without calling dependencies', () => {
    expect(liveness()).toEqual({ status: 'ok' });
  });

  it('is ready only when every probe is up', async () => {
    const report = await collectReadiness([
      { name: 'postgres', check: async () => true },
      { name: 'tei', check: async () => false },
    ]);
    expect(report.ready).toBe(false);
    expect(report.checks.postgres).toBe(DependencyState.Up);
    expect(report.checks.tei).toBe(DependencyState.Down);
  });
});
