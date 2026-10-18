import {
  Language,
  RetrievalBranch,
  VacancySource,
  VacancyStatus,
  type MatchExplanation,
  type RetrievalDiagnostics,
  type RetrievalResponse,
  type TokenUsage,
  type VacancyDto,
  type VacancyResult,
} from '@hira/contracts';

export const TOKEN_USAGE: TokenUsage = { promptTokens: 2, completionTokens: 3, totalTokens: 5 };

const VACANCY_ID = '22222222-2222-4222-8222-222222222222';

/** One ranked card shared by orchestrator tests. */
export function vacancyResult(id = VACANCY_ID): VacancyResult {
  return {
    vacancy: vacancy(id),
    score: 80,
    explanation: explanation(),
    retrievedBy: [RetrievalBranch.Lexical],
  };
}

/** Retrieval envelope with one card. */
export function retrievalResponse(): RetrievalResponse {
  return { results: [vacancyResult()], diagnostics: diagnostics() };
}

function vacancy(id: string): VacancyDto {
  return {
    id,
    source: VacancySource.RabotaBy,
    language: Language.Ru,
    externalId: 'ext-1',
    url: 'https://example.test/vacancy',
    title: 'Python developer',
    companyId: null,
    companyName: '',
    locationId: null,
    locationLabel: null,
    description: 'Python',
    seniority: null,
    employment: null,
    workFormat: null,
    schedule: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryMinByn: null,
    salaryMaxByn: null,
    isGross: null,
    rateAmount: null,
    rateUnit: null,
    projectDurationDays: null,
    isForeignRemote: false,
    status: VacancyStatus.Active,
    publishedAt: '2026-10-18T00:00:00.000Z',
  };
}

function explanation(): MatchExplanation {
  const factor = { score: 80 };
  return {
    totalScore: 80,
    factors: {
      skillFit: factor,
      semanticFit: factor,
      lexicalFit: factor,
      experienceFit: factor,
      formatFit: factor,
      salaryFit: factor,
    },
    matchedSkills: [],
    relatedSkills: [],
    missingSkills: [],
    retrievedBy: [RetrievalBranch.Lexical],
  };
}

function diagnostics(): RetrievalDiagnostics {
  return {
    branchTimings: {
      [RetrievalBranch.Lexical]: 1,
      [RetrievalBranch.Dense]: 2,
      [RetrievalBranch.Graph]: 3,
    },
    candidateCounts: {
      [RetrievalBranch.Lexical]: 1,
      [RetrievalBranch.Dense]: 1,
      [RetrievalBranch.Graph]: 0,
    },
    fusedCount: 1,
    relaxationSteps: [],
    rerankApplied: true,
    totalLatencyMs: 4,
  };
}
