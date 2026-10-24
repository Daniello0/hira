import {
  DocumentKind,
  EmploymentType,
  RateUnit,
  RetrievalBranch,
  SeniorityLevel,
  SkillImportance,
  SkillLevel,
  WorkFormat,
} from '@hira/contracts';

const WORK_FORMAT: Record<WorkFormat, string> = {
  [WorkFormat.Onsite]: 'On-site',
  [WorkFormat.Remote]: 'Remote',
  [WorkFormat.Hybrid]: 'Hybrid',
};

const EMPLOYMENT: Record<EmploymentType, string> = {
  [EmploymentType.FullTime]: 'Full-time',
  [EmploymentType.PartTime]: 'Part-time',
  [EmploymentType.Project]: 'Project',
  [EmploymentType.Freelance]: 'Freelance',
};

const SENIORITY: Record<SeniorityLevel, string> = {
  [SeniorityLevel.NoExperience]: 'No experience',
  [SeniorityLevel.Junior]: 'Junior',
  [SeniorityLevel.Middle]: 'Middle',
  [SeniorityLevel.Senior]: 'Senior',
  [SeniorityLevel.Lead]: 'Lead',
};

const BRANCH: Record<RetrievalBranch, string> = {
  [RetrievalBranch.Lexical]: 'Keyword match',
  [RetrievalBranch.Dense]: 'Meaning match',
  [RetrievalBranch.Graph]: 'Skill graph',
};

const SKILL_LEVEL: Record<SkillLevel, string> = {
  [SkillLevel.Basic]: 'Basic',
  [SkillLevel.Confident]: 'Confident',
  [SkillLevel.Expert]: 'Expert',
};

const IMPORTANCE: Record<SkillImportance, string> = {
  [SkillImportance.Required]: 'Required',
  [SkillImportance.Preferred]: 'Preferred',
  [SkillImportance.Mentioned]: 'Mentioned',
};

const DOCUMENT_KIND: Record<DocumentKind, string> = {
  [DocumentKind.Resume]: 'Resume',
  [DocumentKind.Preferences]: 'Preferences',
  [DocumentKind.Letter]: 'Letter',
  [DocumentKind.Script]: 'Script',
  [DocumentKind.Note]: 'Note',
};

const RATE_UNIT: Record<RateUnit, string> = {
  [RateUnit.Hour]: 'per hour',
  [RateUnit.Day]: 'per day',
  [RateUnit.Project]: 'per project',
};

/** Human name of a work format. Unknown server values pass through. */
export function workFormatLabel(value: WorkFormat): string {
  return WORK_FORMAT[value] ?? value;
}

/** Human name of an employment type. */
export function employmentLabel(value: EmploymentType): string {
  return EMPLOYMENT[value] ?? value;
}

/** Human name of a seniority band. */
export function seniorityLabel(value: SeniorityLevel): string {
  return SENIORITY[value] ?? value;
}

/** Human name of a retrieval branch badge. */
export function branchLabel(value: RetrievalBranch): string {
  return BRANCH[value] ?? value;
}

/** Human name of a profile skill level. */
export function skillLevelLabel(value: SkillLevel): string {
  return SKILL_LEVEL[value] ?? value;
}

/** Human name of how strongly a vacancy asks for a skill. */
export function skillImportanceLabel(value: SkillImportance): string {
  return IMPORTANCE[value] ?? value;
}

/** Human name of a library file kind. */
export function documentKindLabel(value: DocumentKind): string {
  return DOCUMENT_KIND[value] ?? value;
}

/** Human unit of a freelance rate. */
export function rateUnitLabel(value: RateUnit): string {
  return RATE_UNIT[value] ?? value;
}
