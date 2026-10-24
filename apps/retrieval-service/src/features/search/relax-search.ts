import type { RelaxationStep, SkillMention } from '@hira/contracts';
import type { FusedHit } from '../fusion/rrf-fusion';
import type { LinkedSkill } from '../graph/link-query-skill';
import type { SearchFilters } from './hard-filters';
import type { ParsedSearch } from './read-search-request';
import { runBranches, type BranchRun, type BranchSearch } from './run-branches';
import { MAX_RELAXATION_RETRIES, MIN_FUSED_CANDIDATES } from './search.constants';

/** Branch lists and their fusion after S3, plus every soft constraint that was dropped. */
export interface RelaxedRun {
  run: BranchRun;
  fused: FusedHit[];
  steps: RelaxationStep[];
}

/** Soft constraint keys, lightest first. Equal weights fall back to the key order. */
export function softTermsByWeight(soft: Readonly<Record<string, number>>): string[] {
  return Object.entries(soft)
    .filter(([key]) => key.trim().length > 0)
    .sort(([leftKey, left], [rightKey, right]) => left - right || leftKey.localeCompare(rightKey))
    .map(([key]) => key);
}

/**
 * Soft terms in force on each run. Run 0 keeps all of them; each retry drops the lightest;
 * the last retry drops whatever is left, so the final run has hard constraints only.
 */
export function relaxationPlan(terms: readonly string[]): string[][] {
  const plan: string[][] = [[...terms]];
  for (let retry = 1; retry <= MAX_RELAXATION_RETRIES; retry += 1) {
    const previous = plan[plan.length - 1] ?? [];
    if (previous.length === 0) break;
    plan.push(retry === MAX_RELAXATION_RETRIES ? [] : previous.slice(1));
  }
  return plan;
}

/**
 * S3 adaptive relaxation. Hard constraints are never dropped (Wiki 02 S3).
 * While fusion returns fewer than the minimum, the next plan step runs; the query
 * embedding and skill links are computed once and reused across runs.
 */
export async function runRelaxed(
  parsed: ParsedSearch,
  search: BranchSearch,
  fuse: (run: BranchRun) => FusedHit[],
): Promise<RelaxedRun> {
  const plan = relaxationPlan(softTermsByWeight(parsed.intent.softConstraints));
  const reused = reusingPorts(search);
  let current = await attempt(parsed, reused, fuse, plan[0] ?? []);
  const steps: RelaxationStep[] = [];
  for (
    let index = 1;
    index < plan.length && current.fused.length < MIN_FUSED_CANDIDATES;
    index += 1
  ) {
    steps.push(...droppedSteps(plan[index - 1] ?? [], plan[index] ?? []));
    current = await attempt(parsed, reused, fuse, plan[index] ?? []);
  }
  return { ...current, steps };
}

async function attempt(
  parsed: ParsedSearch,
  search: BranchSearch,
  fuse: (run: BranchRun) => FusedHit[],
  softTerms: readonly string[],
): Promise<Omit<RelaxedRun, 'steps'>> {
  const filters: SearchFilters = { ...parsed.intent.hardConstraints, softTerms };
  const run = await runBranches(parsed.intent, parsed.options, search, filters);
  return { run, fused: fuse(run) };
}

function droppedSteps(before: readonly string[], after: readonly string[]): RelaxationStep[] {
  return before.filter((term) => !after.includes(term)).map((constraint) => ({ constraint }));
}

/** Same ports, but the encoder and the skill linker answer once per request. */
function reusingPorts(search: BranchSearch): BranchSearch {
  const vectors = new Map<string, Promise<number[]>>();
  let linked: Promise<LinkedSkill[]> | undefined;
  return {
    searchBm25: (query, filters) => search.searchBm25(query, filters),
    searchDense: (vector, filters) => search.searchDense(vector, filters),
    searchGraph: (ids, filters) => search.searchGraph(ids, filters),
    embedQuery: (text) => remembered(vectors, text, () => search.embedQuery(text)),
    resolveSkills: (mentions: readonly SkillMention[]) =>
      (linked ??= search.resolveSkills(mentions)),
  };
}

function remembered<T>(
  cache: Map<string, Promise<T>>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const loading = load();
  cache.set(key, loading);
  return loading;
}
