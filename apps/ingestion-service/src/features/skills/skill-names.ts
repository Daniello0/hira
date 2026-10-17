/** Canonical skill names in a stable order for `skills_text` and the content hash. */
export function joinSkillNames(names: readonly string[]): string {
  const unique = new Set<string>();
  for (const name of names) {
    const trimmed = name.trim();
    if (trimmed.length > 0) unique.add(trimmed);
  }
  return [...unique].sort((left, right) => left.localeCompare(right)).join(', ');
}
