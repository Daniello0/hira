import { RetrievalBranch, type RetrievalResponse, type VacancyResult } from '@hira/contracts';
import type { ExplainQuery, SkillExplanation } from '../explain/explain-skills';
import type { LoadedVacancy } from './load-vacancy';
import { runBranches, type BranchRun, type BranchSearch } from './run-branches';
import type { ParsedSearch } from './read-search-request';

/** Branches plus the reads that turn hits into cards. */
export interface SearchPorts extends BranchSearch {
  loadVacancies(ids: readonly string[]): Promise<LoadedVacancy[]>;
  coverageFor(skillIds: readonly number[], vacancyIds: readonly string[]): Promise<Map<string, number>>;
  explainVacancies(query: ExplainQuery): Promise<Map<string, SkillExplanation>>;
  rerank(query: string, documents: readonly string[]): Promise<number[]>;
}

/**
 * Runs the three branches and, once fusion exists, the cards.
 * Stub still returns an empty list so the new tests stay red.
 */
export async function runSearch(parsed: ParsedSearch, ports: SearchPorts): Promise<RetrievalResponse> {
  const started = Date.now();
  const run = await runBranches(parsed.intent, parsed.options, ports);
  return emptyResponse(run, Date.now() - started);
}

function emptyResponse(run: BranchRun, totalLatencyMs: number): RetrievalResponse {
  return {
    results: [] as VacancyResult[],
    diagnostics: {
      branchTimings: run.timings,
      candidateCounts: countsOf(run),
      fusedCount: 0,
      relaxationSteps: [],
      rerankApplied: false,
      totalLatencyMs,
    },
  };
}

function countsOf(run: BranchRun): Record<RetrievalBranch, number> {
  return {
    [RetrievalBranch.Lexical]: run.lexical.length,
    [RetrievalBranch.Dense]: run.dense.length,
    [RetrievalBranch.Graph]: run.graph.length,
  };
}
