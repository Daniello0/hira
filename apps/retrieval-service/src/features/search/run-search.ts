import {
  RetrievalBranch,
  type RetrievalResponse,
  type SkillMatch,
  type VacancyResult,
} from '@hira/contracts';
import { scoreFactors } from '../explain/score-factors';
import type { ExplainQuery, SkillExplanation } from '../explain/explain-skills';
import type { FusedHit } from '../fusion/rrf-fusion';
import { fuseBranches } from '../fusion/rrf-fusion';
import { seedIds } from '../graph/link-query-skill';
import { applyRerank, type RankedPage } from '../rerank/apply-rerank';
import type { BranchHit } from './branch-hit';
import type { LoadedVacancy } from './load-vacancy';
import { runBranches, type BranchRun, type BranchSearch } from './run-branches';
import type { ParsedSearch } from './read-search-request';
import { RERANK_WINDOW } from './search.constants';

/** Branches plus the reads that turn hits into cards. */
export interface SearchPorts extends BranchSearch {
  loadVacancies(ids: readonly string[]): Promise<LoadedVacancy[]>;
  coverageFor(
    skillIds: readonly number[],
    vacancyIds: readonly string[],
  ): Promise<Map<string, number>>;
  explainVacancies(query: ExplainQuery): Promise<Map<string, SkillExplanation>>;
  rerank(query: string, documents: readonly string[]): Promise<number[]>;
}

/** Fuses the branches that ran, reranks the top 20, and explains the returned cards. */
export async function runSearch(
  parsed: ParsedSearch,
  ports: SearchPorts,
): Promise<RetrievalResponse> {
  const started = Date.now();
  const run = await runBranches(parsed.intent, parsed.options, ports);
  const active = activeBranches(parsed.options);
  const fused = fuseBranches(
    listsOf(run),
    parsed.intent.complexity,
    parsed.options?.branchWeights,
    active,
  );
  const ranked = await rankFused(parsed, ports, fused);
  const results = await cardsOf(parsed, ports, run, ranked.hits, active);
  return responseOf(run, fused.length, ranked.rerankApplied, results, Date.now() - started);
}

function activeBranches(options: ParsedSearch['options']): RetrievalBranch[] {
  if (options?.branches === undefined) {
    return [RetrievalBranch.Lexical, RetrievalBranch.Dense, RetrievalBranch.Graph];
  }
  return options.branches;
}

function listsOf(run: BranchRun): Partial<Record<RetrievalBranch, BranchHit[]>> {
  return {
    [RetrievalBranch.Lexical]: run.lexical,
    [RetrievalBranch.Dense]: run.dense,
    [RetrievalBranch.Graph]: run.graph,
  };
}

async function rankFused(
  parsed: ParsedSearch,
  ports: SearchPorts,
  fused: readonly FusedHit[],
): Promise<RankedPage> {
  if (parsed.options?.rerank === false || fused.length === 0) {
    return { hits: fused.slice(0, parsed.limit), rerankApplied: false };
  }
  try {
    const scores = await scoreWindow(parsed, ports, fused.slice(0, RERANK_WINDOW));
    return applyRerank(fused, scores, parsed.limit);
  } catch {
    return { hits: fused.slice(0, parsed.limit), rerankApplied: false };
  }
}

async function scoreWindow(
  parsed: ParsedSearch,
  ports: SearchPorts,
  window: readonly FusedHit[],
): Promise<number[]> {
  const loaded = await ports.loadVacancies(window.map((hit) => hit.vacancyId));
  const documents = new Map(loaded.map((row) => [row.vacancy.id, row.searchDocument]));
  return ports.rerank(
    parsed.intent.rewrittenQuery,
    window.map((hit) => documents.get(hit.vacancyId) ?? ''),
  );
}

async function cardsOf(
  parsed: ParsedSearch,
  ports: SearchPorts,
  run: BranchRun,
  hits: readonly FusedHit[],
  active: readonly RetrievalBranch[],
): Promise<VacancyResult[]> {
  const loaded = await ports.loadVacancies(hits.map((hit) => hit.vacancyId));
  const byId = new Map(loaded.map((row) => [row.vacancy.id, row]));
  const present = hits.filter((hit) => byId.has(hit.vacancyId));
  const explained = await explainPresent(parsed, ports, run, present, active);
  return present.map((hit) =>
    cardOf(hit, byId.get(hit.vacancyId) as LoadedVacancy, run, parsed, explained),
  );
}

async function explainPresent(
  parsed: ParsedSearch,
  ports: SearchPorts,
  run: BranchRun,
  hits: readonly FusedHit[],
  active: readonly RetrievalBranch[],
): Promise<CardContext> {
  const ids = hits.map((hit) => hit.vacancyId);
  const graphRan = active.includes(RetrievalBranch.Graph) && run.linked.length > 0;
  const coverage = graphRan
    ? await ports.coverageFor(seedIds(run.linked), ids)
    : new Map<string, number>();
  const skills = await ports.explainVacancies({
    vacancyIds: ids,
    linked: run.linked,
    userId: parsed.userId,
  });
  return { coverage, skills, graphRan };
}

interface CardContext {
  coverage: Map<string, number>;
  skills: Map<string, SkillExplanation>;
  graphRan: boolean;
}

function cardOf(
  hit: FusedHit,
  loaded: LoadedVacancy,
  run: BranchRun,
  parsed: ParsedSearch,
  context: CardContext,
): VacancyResult {
  const factors = scoreFactors(factorInput(hit, loaded, run, parsed, context));
  const skills = context.skills.get(hit.vacancyId) ?? emptySkills();
  return {
    vacancy: loaded.vacancy,
    score: factors.totalScore,
    retrievedBy: hit.retrievedBy,
    explanation: explanationOf(factors, skills, hit.retrievedBy),
  };
}

function explanationOf(
  factors: ReturnType<typeof scoreFactors>,
  skills: SkillExplanation,
  retrievedBy: FusedHit['retrievedBy'],
): VacancyResult['explanation'] {
  return { totalScore: factors.totalScore, factors: factors.factors, ...skills, retrievedBy };
}

function factorInput(
  hit: FusedHit,
  loaded: LoadedVacancy,
  run: BranchRun,
  parsed: ParsedSearch,
  context: CardContext,
) {
  const constraints = parsed.intent.hardConstraints;
  return {
    graphRan: context.graphRan,
    coverage: context.coverage.get(hit.vacancyId) ?? null,
    denseDistance: scoreOf(run.dense, hit.vacancyId),
    lexicalRank: rankOf(run.lexical, hit.vacancyId),
    querySeniority: parsed.intent.seniority,
    vacancySeniority: loaded.seniority,
    workFormatAsked: (constraints.workFormat?.length ?? 0) > 0,
    employmentAsked: (constraints.employment?.length ?? 0) > 0,
    salaryAsked: constraints.salaryMin !== undefined,
  };
}

function responseOf(
  run: BranchRun,
  fusedCount: number,
  rerankApplied: boolean,
  results: VacancyResult[],
  totalLatencyMs: number,
): RetrievalResponse {
  return {
    results,
    diagnostics: {
      branchTimings: run.timings,
      candidateCounts: countsOf(run),
      fusedCount,
      relaxationSteps: [],
      rerankApplied,
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

function scoreOf(hits: readonly BranchHit[], vacancyId: string): number | null {
  return hits.find((hit) => hit.vacancyId === vacancyId)?.score ?? null;
}

function rankOf(hits: readonly BranchHit[], vacancyId: string): number | null {
  return hits.find((hit) => hit.vacancyId === vacancyId)?.rank ?? null;
}

function emptySkills(): {
  matchedSkills: SkillMatch[];
  relatedSkills: SkillMatch[];
  missingSkills: SkillMatch[];
} {
  return { matchedSkills: [], relatedSkills: [], missingSkills: [] };
}
