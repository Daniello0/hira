import { ENV } from '../../common/constants/app.constants';
import { readHostPort } from '../../common/utils/host-port';
import { probeTcp } from '../../common/utils/probe-tcp';
import {
  DEPENDENCY_PROBE_TIMEOUT_MS,
  POSTGRES_DEFAULT_PORT,
  REDIS_DEFAULT_PORT,
} from './health.constants';
import type { DependencyProbe } from './health.types';

/** Core API depends on PostgreSQL and Redis (sessions, rate limits, queues). */
export function buildCoreApiProbes(env: NodeJS.ProcessEnv): DependencyProbe[] {
  return [
    tcpProbe('postgres', env[ENV.databaseUrl], POSTGRES_DEFAULT_PORT),
    tcpProbe('redis', env[ENV.redisUrl], REDIS_DEFAULT_PORT),
  ];
}

function tcpProbe(name: string, rawUrl: string | undefined, defaultPort: number): DependencyProbe {
  return { name, check: () => checkTcp(rawUrl, defaultPort) };
}

async function checkTcp(rawUrl: string | undefined, defaultPort: number): Promise<boolean> {
  const endpoint = readHostPort(rawUrl, defaultPort);
  if (endpoint === null) {
    return false;
  }
  return probeTcp(endpoint.host, endpoint.port, DEPENDENCY_PROBE_TIMEOUT_MS);
}
