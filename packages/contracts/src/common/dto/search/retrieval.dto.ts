import type { RetrievalBranch } from '../../enums/retrieval-branch.enum';
import type { MatchExplanation } from './match-explanation.dto';
import type { SearchIntent } from './search-intent.dto';
import type { VacancyDto } from '../vacancy/vacancy.dto';

/** One recorded drop of a soft constraint during adaptive relaxation. */
export interface RelaxationStep {
  constraint: string;
}

/** Knobs the evaluation harness uses to run ablations on the production path. */
export interface RetrievalOptions {
  branches?: RetrievalBranch[];
  rerank?: boolean;
  branchWeights?: Record<RetrievalBranch, number>;
  personalize?: boolean;
}

/** Body of `POST /internal/v1/search`. Shape follows Wiki/05-api-contracts.md. */
export interface RetrievalRequest {
  intent: SearchIntent;
  userId?: string;
  limit: number;
  options?: RetrievalOptions;
}

/** One ranked vacancy returned by retrieval. */
export interface VacancyResult {
  vacancy: VacancyDto;
  score: number;
  explanation: MatchExplanation;
  retrievedBy: RetrievalBranch[];
}

/** Diagnostics returned next to the ranked list. */
export interface RetrievalDiagnostics {
  branchTimings: Record<RetrievalBranch, number>;
  candidateCounts: Record<RetrievalBranch, number>;
  fusedCount: number;
  relaxationSteps: RelaxationStep[];
  rerankApplied: boolean;
  totalLatencyMs: number;
}

/** Body returned by `POST /internal/v1/search`. */
export interface RetrievalResponse {
  results: VacancyResult[];
  diagnostics: RetrievalDiagnostics;
}
