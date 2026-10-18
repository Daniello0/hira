import type { RetrievalDiagnostics, SearchIntent } from '@hira/contracts';

/** Lines for the context panel. Empty relaxation stays hidden. */
export function constraintLines(intent: SearchIntent | null, diagnostics: RetrievalDiagnostics | null): string[] {
  const applied = intent === null ? [] : hardLines(intent);
  const softened = (diagnostics?.relaxationSteps ?? []).map((step) => `Softened: ${step.constraint}`);
  return [...applied, ...softened];
}

function hardLines(intent: SearchIntent): string[] {
  const hard = intent.hardConstraints;
  const lines: string[] = [];
  if (intent.role) lines.push(`Role: ${intent.role}`);
  if (hard.workFormat && hard.workFormat.length > 0) lines.push(`Format: ${hard.workFormat.join(', ')}`);
  if (hard.employment && hard.employment.length > 0) lines.push(`Employment: ${hard.employment.join(', ')}`);
  if (hard.location && hard.location.length > 0) lines.push(`Location: ${hard.location.join(', ')}`);
  if (hard.salaryMin !== undefined) lines.push(`Salary from: ${hard.salaryMin}`);
  return lines;
}

/** Skill surfaces the model pulled out of the latest turn. */
export function intentSkills(intent: SearchIntent | null): string[] {
  if (intent === null) return [];
  return intent.skills.map((skill) => skill.surface);
}
