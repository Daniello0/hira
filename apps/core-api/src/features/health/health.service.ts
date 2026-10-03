import { Inject, Injectable } from '@nestjs/common';
import { HEALTH_PROBES } from './health.constants';
import {
  DependencyState,
  HealthStatus,
  type DependencyProbe,
  type LivenessResponse,
  type ReadinessReport,
  type ReadinessResponse,
} from './health.types';

/** Answers liveness and readiness for core-api. */
@Injectable()
export class HealthService {
  constructor(@Inject(HEALTH_PROBES) private readonly probes: readonly DependencyProbe[]) {}

  /** Liveness does not touch dependencies. */
  liveness(): LivenessResponse {
    return { status: HealthStatus.Ok };
  }

  /** Readiness runs every configured dependency probe. */
  readiness(): Promise<ReadinessReport> {
    return collectReadiness(this.probes);
  }
}

/** Readiness payload for a service whose dependencies are up. */
export function toReadinessResponse(report: ReadinessReport): ReadinessResponse {
  return { status: HealthStatus.Ok, checks: report.checks };
}

async function collectReadiness(probes: readonly DependencyProbe[]): Promise<ReadinessReport> {
  const checks = await runProbes(probes);
  const ready = Object.values(checks).every((state) => state === DependencyState.Up);
  return { ready, checks };
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
