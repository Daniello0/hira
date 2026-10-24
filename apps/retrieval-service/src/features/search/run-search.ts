import {
  RetrievalBranch,
  type RelaxationStep,
  type RetrievalResponse,
  type SkillMatch,
  type VacancyResult,
} from '@hira/contracts';
import { scoreFactors } from '../explain/score-factors';
import type { ExplainQuery, SkillExplanation } from '../explain/explain-skills';
import type { FusedHit } from '../fusion/rrf-fusion';
import { fuseBranches } from '../fusion/rrf-fusion';
import { seedIds } from '../graph/link-query-skill';
import { personalizePage, type PersonalPorts } from '../personalize/personalize-page';
import type { ProfileSignals } from '../personalize/profile-signals';
import { applyRerank, type RankedPage } from '../rerank/apply-rerank';
import type { BranchHit } from './branch-hit';
import type { LoadedVacancy } from './load-vacancy';
import type { BranchRun, BranchSearch } from './run-branches';
import type { ParsedSearch } from './read-search-request';
import { runRelaxed } from './relax-search';
import { RERANK_WINDOW } from './search.constants';

/** Branches plus the reads that turn hits into cards and personalize them. */
export interface SearchPorts extends BranchSearch, PersonalPorts {
  loadVacancies(ids: readonly string[]): Promise<LoadedVacancy[]>;
  coverageFor(
    skillIds: readonly number[],
    vacancyIds: readonly string[],
  ): Promise<Map<string, number>>;
  explainVacancies(query: ExplainQuery): Promise<Map<string, SkillExplanation>>;
  rerank(query: string, documents: readonly string[]): Promise<number[]>;
}

/**
 * Fuses the branches that ran (relaxing soft constraints while candidates are few),
 * reranks the top 20, personalizes them for the user, and explains the returned cards.
 */
export async function runSearch(
  parsed: ParsedSearch,
  ports: SearchPorts,
): Promise<RetrievalResponse> {
  const started = Date.now();
  const active = activeBranches(parsed.options);
  const relaxed = await runRelaxed(parsed, ports, (run) => fuseRun(parsed, run, active));
  const userId = personalUserId(parsed);
  const ranked = await rankFused(parsed, ports, relaxed.fused, pageSizeOf(parsed.limit, userId));
  const page = await personalizePage(ranked.hits, userId, ports);
  const hits = page.hits.slice(0, parsed.limit);
  const results = await cardsOf(parsed, ports, relaxed.run, hits, {
    active,
    userId,
    signals: page.signals,
  });
  return responseOf(relaxed, ranked.rerankApplied, results, Date.now() - started);
}

function fuseRun(
  parsed: ParsedSearch,
  run: BranchRun,
  active: readonly RetrievalBranch[],
): FusedHit[] {
  return fuseBranches(
    listsOf(run),
    parsed.intent.complexity,
    parsed.options?.branchWeights,
    active,
  );
}

/** The user whose profile S5 and the skill lists read; none when `personalize` is false. */
function personalUserId(parsed: ParsedSearch): string | undefined {
  return parsed.options?.personalize === false ? undefined : parsed.userId;
}

/** With a profile, S5 reorders the whole rerank window before the page is cut. */
function pageSizeOf(limit: number, userId: string | undefined): number {
  return userId === undefined ? limit : Math.max(limit, RERANK_WINDOW);
}

interface CardScope {
  active: readonly RetrievalBranch[];
  userId: string | undefined;
  signals: ReadonlyMap<string, ProfileSignals>;
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
  pageSize: number,
): Promise<RankedPage> {
  if (parsed.options?.rerank === false || fused.length === 0) {
    return { hits: fused.slice(0, pageSize), rerankApplied: false };
  }
  try {
    const scores = await scoreWindow(parsed, ports, fused.slice(0, RERANK_WINDOW));
    return applyRerank(fused, scores, pageSize);
  } catch {
    return { hits: fused.slice(0, pageSize), rerankApplied: false };
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
  scope: CardScope,
): Promise<VacancyResult[]> {
  const loaded = await ports.loadVacancies(hits.map((hit) => hit.vacancyId));
  const byId = new Map(loaded.map((row) => [row.vacancy.id, row]));
  const present = hits.filter((hit) => byId.has(hit.vacancyId));
  const explained = await explainPresent(ports, run, present, scope);
  return present.map((hit) =>
    cardOf(hit, byId.get(hit.vacancyId) as LoadedVacancy, run, parsed, explained),
  );
}

async function explainPresent(
  ports: SearchPorts,
  run: BranchRun,
  hits: readonly FusedHit[],
  scope: CardScope,
): Promise<CardContext> {
  const ids = hits.map((hit) => hit.vacancyId);
  const graphRan = scope.active.includes(RetrievalBranch.Graph) && run.linked.length > 0;
  const coverage = graphRan
    ? await ports.coverageFor(seedIds(run.linked), ids)
    : new Map<string, number>();
  const skills = await ports.explainVacancies({
    vacancyIds: ids,
    linked: run.linked,
    userId: scope.userId,
  });
  return { coverage, skills, graphRan, signals: scope.signals };
}

interface CardContext {
  coverage: Map<string, number>;
  skills: Map<string, SkillExplanation>;
  graphRan: boolean;
  signals: ReadonlyMap<string, ProfileSignals>;
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
    profile: context.signals.get(hit.vacancyId) ?? null,
  };
}

function responseOf(
  relaxed: { run: BranchRun; fused: readonly FusedHit[]; steps: RelaxationStep[] },
  rerankApplied: boolean,
  results: VacancyResult[],
  totalLatencyMs: number,
): RetrievalResponse {
  return {
    results,
    diagnostics: {
      branchTimings: relaxed.run.timings,
      candidateCounts: countsOf(relaxed.run),
      fusedCount: relaxed.fused.length,
      relaxationSteps: relaxed.steps,
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
