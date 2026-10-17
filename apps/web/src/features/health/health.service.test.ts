import { afterEach, describe, expect, it, vi } from 'vitest';
import { DependencyState } from './health.types';
import { buildWebProbes, collectReadiness, liveness } from './health.service';

describe('web health', () => {
  it('reports liveness without calling core-api', () => {
    expect(liveness()).toEqual({ status: 'ok' });
  });

  it('is not ready when CORE_API_URL is missing', async () => {
    const report = await collectReadiness(buildWebProbes(webEnv()));
    expect(report.ready).toBe(false);
    expect(report.checks['core-api']).toBe(DependencyState.Down);
  });

  it('probes core-api readiness, not liveness', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const report = await collectReadiness(
      buildWebProbes(webEnv({ CORE_API_URL: 'http://core-api:4000/' })),
    );
    expect(report.ready).toBe(true);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('http://core-api:4000/health/ready');
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function webEnv(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { NODE_ENV: 'test', ...values };
}
