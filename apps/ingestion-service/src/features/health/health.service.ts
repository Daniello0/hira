import {
  DependencyState,
  HealthStatus,
  type DependencyProbe,
  type LivenessResponse,
  type ReadinessReport,
  type ReadinessResponse,
} from './health.types';

/** Liveness payload. It does not touch dependencies. */
export function liveness(): LivenessResponse {
  return { status: HealthStatus.Ok };
}

/** Runs every probe and reports whether all of them are up. */
export async function collectReadiness(
  probes: readonly DependencyProbe[],
): Promise<ReadinessReport> {
  const checks = await runProbes(probes);
  const ready = Object.values(checks).every((state) => state === DependencyState.Up);
  return { ready, checks };
}

/** Readiness payload for a service whose dependencies are up. */
export function toReadinessResponse(report: ReadinessReport): ReadinessResponse {
  return { status: HealthStatus.Ok, checks: report.checks };
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
