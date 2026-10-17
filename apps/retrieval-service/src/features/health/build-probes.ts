import { ENV } from '../../common/constants/app.constants';
import { readHostPort } from '../../common/utils/host-port';
import { probeTcp } from '../../common/utils/probe-tcp';
import { DEPENDENCY_PROBE_TIMEOUT_MS, POSTGRES_DEFAULT_PORT } from './health.constants';
import { postJson, probeEmbedding, probeRerank, type JsonPost } from './probe-tei';
import type { DependencyProbe } from './health.types';

/** Dependencies of retrieval: PostgreSQL, a 1024-d encoder, and a scoring reranker. */
export function buildRetrievalProbes(
  env: NodeJS.ProcessEnv,
  post: JsonPost = { post: postJson },
): DependencyProbe[] {
  return [
    tcpProbe('postgres', env[ENV.databaseUrl], POSTGRES_DEFAULT_PORT),
    named('tei', () => probeEmbedding(post, env[ENV.teiEmbedUrl])),
    named('tei-rerank', () => probeRerank(post, env[ENV.teiRerankUrl])),
  ];
}

function named(name: string, check: () => Promise<boolean>): DependencyProbe {
  return { name, check };
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
