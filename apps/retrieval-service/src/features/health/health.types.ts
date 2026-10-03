export enum HealthStatus {
  Ok = 'ok',
}

export enum DependencyState {
  Up = 'up',
  Down = 'down',
}

export interface DependencyProbe {
  name: string;
  check: () => Promise<boolean>;
}

export interface ReadinessReport {
  ready: boolean;
  checks: Record<string, DependencyState>;
}

export interface LivenessResponse {
  status: HealthStatus;
}

export interface ReadinessResponse {
  status: HealthStatus;
  checks: Record<string, DependencyState>;
}
