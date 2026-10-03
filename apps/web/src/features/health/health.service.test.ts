import { describe, expect, it } from 'vitest';
import { DependencyState } from './health.types';
import { buildWebProbes, collectReadiness, liveness } from './health.service';

describe('web health', () => {
  it('reports liveness without calling core-api', () => {
    expect(liveness()).toEqual({ status: 'ok' });
  });

  it('is not ready when CORE_API_URL is missing', async () => {
    const report = await collectReadiness(buildWebProbes({}));
    expect(report.ready).toBe(false);
    expect(report.checks['core-api']).toBe(DependencyState.Down);
  });
});
