/** True when a model weight fits the `vacancy_skills.weight` check. */
export function isSkillWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight >= 0 && weight <= 1;
}
