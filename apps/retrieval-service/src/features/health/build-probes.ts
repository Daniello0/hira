import { ENV } from '../../common/constants/app.constants';
import { readHostPort } from '../../common/utils/host-port';
import { probeHttp } from '../../common/utils/probe-http';
import { probeTcp } from '../../common/utils/probe-tcp';
import { DEPENDENCY_PROBE_TIMEOUT_MS, POSTGRES_DEFAULT_PORT } from './health.constants';
import type { DependencyProbe } from './health.types';

/** Dependencies of retrieval: PostgreSQL, the encoder, and the reranker. */
export function buildRetrievalProbes(env: NodeJS.ProcessEnv): DependencyProbe[] {
  return [
    tcpProbe('postgres', env[ENV.databaseUrl], POSTGRES_DEFAULT_PORT),
    httpProbe('tei', joinHealthUrl(env[ENV.teiEmbedUrl])),
    httpProbe('tei-rerank', joinHealthUrl(env[ENV.teiRerankUrl])),
  ];
}

function joinHealthUrl(base: string | undefined): string | undefined {
  if (base === undefined || base.trim().length === 0) {
    return undefined;
  }
  return `${base.replace(/\/$/, '')}/health`;
}

function tcpProbe(name: string, rawUrl: string | undefined, defaultPort: number): DependencyProbe {
  return { name, check: () => checkTcp(rawUrl, defaultPort) };
}

function httpProbe(name: string, url: string | undefined): DependencyProbe {
  return { name, check: () => checkHttp(url) };
}

async function checkTcp(rawUrl: string | undefined, defaultPort: number): Promise<boolean> {
  const endpoint = readHostPort(rawUrl, defaultPort);
  if (endpoint === null) {
    return false;
  }
  return probeTcp(endpoint.host, endpoint.port, DEPENDENCY_PROBE_TIMEOUT_MS);
}

function checkHttp(url: string | undefined): Promise<boolean> {
  if (url === undefined) {
    return Promise.resolve(false);
  }
  return probeHttp(url, DEPENDENCY_PROBE_TIMEOUT_MS);
}
