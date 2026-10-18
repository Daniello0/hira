import {
  IntentType,
  QueryComplexity,
  RetrievalBranch,
  type HardConstraints,
  type RetrievalOptions,
  type SearchIntent,
} from '@hira/contracts';
import type { BranchHit } from './branch-hit';

export interface BranchSearch {
  searchBm25(query: string, filters: HardConstraints): Promise<BranchHit[]>;
  embedQuery(text: string): Promise<number[]>;
  searchDense(vector: readonly number[], filters: HardConstraints): Promise<BranchHit[]>;
}

export interface BranchRun {
  lexical: BranchHit[];
  dense: BranchHit[];
  timings: Record<RetrievalBranch, number>;
}

interface Timed<T> {
  value: T;
  ms: number;
}

/** Runs the lexical and dense branches selected for this request. */
export async function runBranches(
  intent: SearchIntent,
  options: RetrievalOptions | undefined,
  search: BranchSearch,
): Promise<BranchRun> {
  if (intent.rewrittenQuery.trim().length === 0) return emptyRun();
  const selected = selectedBranches(options);
  const started = startTasks(intent, selected, search);
  const [lexical, embedded] = await Promise.all([started.lexical, started.embed]);
  const dense = await finishDense(search, intent.hardConstraints, selected.dense, embedded);
  return {
    lexical: lexical.value,
    dense: dense.value,
    timings: timingsOf(lexical.ms, embedded.ms + dense.ms),
  };
}

/** Minimal intent used by tests and by a request that only carries a query. */
export function emptyIntent(query: string): SearchIntent {
  return {
    rewrittenQuery: query,
    role: null,
    skills: [],
    seniority: null,
    hardConstraints: {},
    softConstraints: {},
    complexity: QueryComplexity.Simple,
    intentType: IntentType.Search,
  };
}

function startTasks(intent: SearchIntent, selected: BranchChoice, search: BranchSearch) {
  const filters = intent.hardConstraints;
  const query = intent.rewrittenQuery;
  return {
    lexical: selected.lexical ? timed(() => search.searchBm25(query, filters)) : idle<BranchHit[]>([]),
    embed: selected.dense ? timed(() => search.embedQuery(query)) : idle<number[] | null>(null),
  };
}

async function finishDense(
  search: BranchSearch,
  filters: HardConstraints,
  enabled: boolean,
  embedded: Timed<number[] | null>,
): Promise<Timed<BranchHit[]>> {
  if (!enabled || embedded.value === null) return { value: [], ms: 0 };
  return timed(() => search.searchDense(embedded.value as number[], filters));
}

function selectedBranches(options: RetrievalOptions | undefined): BranchChoice {
  const list = options?.branches;
  if (list === undefined) return { lexical: true, dense: true };
  return {
    lexical: list.includes(RetrievalBranch.Lexical),
    dense: list.includes(RetrievalBranch.Dense),
  };
}

function timingsOf(lexical: number, dense: number): Record<RetrievalBranch, number> {
  return {
    [RetrievalBranch.Lexical]: lexical,
    [RetrievalBranch.Dense]: dense,
    [RetrievalBranch.Graph]: 0,
  };
}

function emptyRun(): BranchRun {
  return { lexical: [], dense: [], timings: timingsOf(0, 0) };
}

async function timed<T>(run: () => Promise<T>): Promise<Timed<T>> {
  const started = Date.now();
  const value = await run();
  return { value, ms: Date.now() - started };
}

function idle<T>(value: T): Promise<Timed<T>> {
  return Promise.resolve({ value, ms: 0 });
}

interface BranchChoice {
  lexical: boolean;
  dense: boolean;
}
