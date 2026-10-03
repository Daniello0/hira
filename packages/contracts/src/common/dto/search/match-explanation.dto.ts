import type { RetrievalBranch } from '../../enums/retrieval-branch.enum';

/** Numeric contribution of one explanation factor. `totalScore` is the 0..100 aggregate. */
export interface FactorScore {
  score: number;
}

/**
 * A skill cited in a match explanation.
 * `path` is set for skills reached through the graph.
 */
export interface SkillMatch {
  surface: string;
  canonicalId: string | null;
  evidenceSpan: string | null;
  path: string | null;
}

/** Deterministic match explanation. Shape follows Wiki/02-retrieval-layer.md step S6. */
export interface MatchExplanation {
  totalScore: number;
  factors: {
    skillFit: FactorScore;
    semanticFit: FactorScore;
    lexicalFit: FactorScore;
    experienceFit: FactorScore;
    formatFit: FactorScore;
    salaryFit: FactorScore;
  };
  matchedSkills: SkillMatch[];
  relatedSkills: SkillMatch[];
  missingSkills: SkillMatch[];
  retrievedBy: RetrievalBranch[];
}
