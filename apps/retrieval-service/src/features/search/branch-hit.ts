/** One vacancy returned by a single retrieval branch. */
export interface BranchHit {
  vacancyId: string;
  rank: number;
  score: number;
}

export interface ScoredVacancy {
  vacancyId: string;
  score: number;
}
