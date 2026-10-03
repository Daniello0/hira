import type { EmploymentType } from '../../enums/employment-type.enum';
import type { IntentType } from '../../enums/intent-type.enum';
import type { QueryComplexity } from '../../enums/query-complexity.enum';
import type { SeniorityLevel } from '../../enums/seniority-level.enum';
import type { WorkFormat } from '../../enums/work-format.enum';

/** A skill the query understanding step pulled out of the message. */
export interface SkillMention {
  surface: string;
  canonicalId: string | null;
  required: boolean;
}

/** Constraints the retrieval layer must not drop. */
export interface HardConstraints {
  workFormat?: WorkFormat[];
  employment?: EmploymentType[];
  location?: string[];
  salaryMin?: number;
}

/** Structured intent produced by `llm-service`. Shape follows Wiki/02-retrieval-layer.md. */
export interface SearchIntent {
  rewrittenQuery: string;
  role: string | null;
  skills: SkillMention[];
  seniority: SeniorityLevel | null;
  hardConstraints: HardConstraints;
  softConstraints: Record<string, number>;
  complexity: QueryComplexity;
  intentType: IntentType;
}
