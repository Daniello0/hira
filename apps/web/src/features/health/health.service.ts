import { probeHttp } from '../../common/utils/probe-http';
import { DEPENDENCY_PROBE_TIMEOUT_MS, ENV } from './health.constants';
import {
  DependencyState,
  HealthStatus,
  type DependencyProbe,
  type LivenessResponse,
  type ReadinessReport,
  type ReadinessResponse,
} from './health.types';

/** Liveness payload. It does not call core-api. */
export function liveness(): LivenessResponse {
  return { status: HealthStatus.Ok };
}

/** The browser app is ready when core-api liveness answers. */
export function buildWebProbes(env: NodeJS.ProcessEnv): DependencyProbe[] {
  return [{ name: 'core-api', check: () => checkCoreApi(env[ENV.coreApiUrl]) }];
}

/** Runs every probe and reports whether all of them are up. */
export async function collectReadiness(
  probes: readonly DependencyProbe[],
): Promise<ReadinessReport> {
  const checks = await runProbes(probes);
  const ready = Object.values(checks).every((state) => state === DependencyState.Up);
  return { ready, checks };
}

/** Readiness payload for a web process whose dependencies are up. */
export function toReadinessResponse(report: ReadinessReport): ReadinessResponse {
  return { status: HealthStatus.Ok, checks: report.checks };
}

function checkCoreApi(baseUrl: string | undefined): Promise<boolean> {
  const url = joinHealthUrl(baseUrl);
  if (url === undefined) {
    return Promise.resolve(false);
  }
  return probeHttp(url, DEPENDENCY_PROBE_TIMEOUT_MS);
}

function joinHealthUrl(base: string | undefined): string | undefined {
  if (base === undefined || base.trim().length === 0) {
    return undefined;
  }
  return `${base.replace(/\/$/, '')}/health`;
}

async function runProbes(
  probes: readonly DependencyProbe[],
): Promise<Record<string, DependencyState>> {
  const checks: Record<string, DependencyState> = {};
  for (const probe of probes) {
    checks[probe.name] = (await probe.check()) ? DependencyState.Up : DependencyState.Down;
  }
  return checks;
}
