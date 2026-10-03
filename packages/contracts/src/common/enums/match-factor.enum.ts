/**
 * Deterministic explanation factors from Wiki/02-retrieval-layer.md (step S6)
 * and Wiki/01-architecture.md (`MatchFactor`).
 */
export enum MatchFactor {
  SkillFit = 'SKILL_FIT',
  SemanticFit = 'SEMANTIC_FIT',
  LexicalFit = 'LEXICAL_FIT',
  ExperienceFit = 'EXPERIENCE_FIT',
  FormatFit = 'FORMAT_FIT',
  SalaryFit = 'SALARY_FIT',
}
