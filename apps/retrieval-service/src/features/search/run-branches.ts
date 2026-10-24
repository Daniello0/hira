import {
  IntentType,
  QueryComplexity,
  RetrievalBranch,
  type RetrievalOptions,
  type SearchIntent,
  type SkillMention,
} from '@hira/contracts';
import { seedIds, type LinkedSkill } from '../graph/link-query-skill';
import type { BranchHit } from './branch-hit';
import type { SearchFilters } from './hard-filters';

export interface BranchSearch {
  searchBm25(query: string, filters: SearchFilters): Promise<BranchHit[]>;
  embedQuery(text: string): Promise<number[]>;
  searchDense(vector: readonly number[], filters: SearchFilters): Promise<BranchHit[]>;
  resolveSkills(mentions: readonly SkillMention[]): Promise<LinkedSkill[]>;
  searchGraph(skillIds: readonly number[], filters: SearchFilters): Promise<BranchHit[]>;
}

export interface BranchRun {
  lexical: BranchHit[];
  dense: BranchHit[];
  graph: BranchHit[];
  linked: LinkedSkill[];
  timings: Record<RetrievalBranch, number>;
}

interface Timed<T> {
  value: T;
  ms: number;
}

/**
 * Runs the lexical, dense, and graph branches selected for this request.
 * `filters` defaults to the intent's hard constraints; relaxation passes soft terms on top.
 */
export async function runBranches(
  intent: SearchIntent,
  options: RetrievalOptions | undefined,
  search: BranchSearch,
  filters: SearchFilters = intent.hardConstraints,
): Promise<BranchRun> {
  if (intent.rewrittenQuery.trim().length === 0) return emptyRun();
  const selected = selectedBranches(options);
  const started = startTasks(intent, filters, selected, search);
  const [lexical, embedded, linked] = await Promise.all([
    started.lexical,
    started.embed,
    started.link,
  ]);
  const [dense, graph] = await Promise.all([
    finishDense(search, filters, selected.dense, embedded),
    finishGraph(search, filters, selected.graph, linked),
  ]);
  return assembled(lexical, embedded, dense, graph, linked, selected.graph);
}

function assembled(
  lexical: Timed<BranchHit[]>,
  embedded: Timed<number[] | null>,
  dense: Timed<BranchHit[]>,
  graph: Timed<BranchHit[]>,
  linked: Timed<LinkedSkill[]>,
  graphOn: boolean,
): BranchRun {
  return {
    lexical: lexical.value,
    dense: dense.value,
    graph: graph.value,
    linked: graphOn ? linked.value : [],
    timings: timingsOf(lexical.ms, embedded.ms + dense.ms, linked.ms + graph.ms),
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

function startTasks(
  intent: SearchIntent,
  filters: SearchFilters,
  selected: BranchChoice,
  search: BranchSearch,
) {
  const query = intent.rewrittenQuery;
  return {
    lexical: selected.lexical
      ? timed(() => search.searchBm25(query, filters))
      : idle<BranchHit[]>([]),
    embed: selected.dense ? timed(() => search.embedQuery(query)) : idle<number[] | null>(null),
    link: selected.graph
      ? timed(() => search.resolveSkills(intent.skills))
      : idle<LinkedSkill[]>([]),
  };
}

async function finishDense(
  search: BranchSearch,
  filters: SearchFilters,
  enabled: boolean,
  embedded: Timed<number[] | null>,
): Promise<Timed<BranchHit[]>> {
  if (!enabled || embedded.value === null) return { value: [], ms: 0 };
  return timed(() => search.searchDense(embedded.value as number[], filters));
}

async function finishGraph(
  search: BranchSearch,
  filters: SearchFilters,
  enabled: boolean,
  linked: Timed<LinkedSkill[]>,
): Promise<Timed<BranchHit[]>> {
  if (!enabled) return { value: [], ms: 0 };
  return timed(() => search.searchGraph(seedIds(linked.value), filters));
}

function selectedBranches(options: RetrievalOptions | undefined): BranchChoice {
  const list = options?.branches;
  if (list === undefined) return { lexical: true, dense: true, graph: true };
  return {
    lexical: list.includes(RetrievalBranch.Lexical),
    dense: list.includes(RetrievalBranch.Dense),
    graph: list.includes(RetrievalBranch.Graph),
  };
}

function timingsOf(lexical: number, dense: number, graph: number): Record<RetrievalBranch, number> {
  return {
    [RetrievalBranch.Lexical]: lexical,
    [RetrievalBranch.Dense]: dense,
    [RetrievalBranch.Graph]: graph,
  };
}

function emptyRun(): BranchRun {
  return { lexical: [], dense: [], graph: [], linked: [], timings: timingsOf(0, 0, 0) };
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
  graph: boolean;
}
