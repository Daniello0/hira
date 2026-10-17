interface Rule {
  allow: boolean;
  pattern: string;
}

/** Whether `User-agent: *` allows the path. A missing robots file refuses the fetch. */
export function isFetchAllowed(robots: string | null, path: string): boolean {
  if (robots === null) return false;
  const matched = starRules(robots).filter((rule) => ruleMatches(rule.pattern, path));
  if (matched.length === 0) return true;
  const winner = [...matched].sort((left, right) => right.pattern.length - left.pattern.length)[0];
  return winner?.allow ?? true;
}

function starRules(robots: string): Rule[] {
  const rules: Rule[] = [];
  let active = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.split('#')[0]?.trim() ?? '';
    active = applyLine(line, active, rules);
  }
  return rules;
}

function applyLine(line: string, active: boolean, rules: Rule[]): boolean {
  if (line.length === 0) return active;
  const separator = line.indexOf(':');
  if (separator < 0) return active;
  const key = line.slice(0, separator).trim().toLowerCase();
  const value = line.slice(separator + 1).trim();
  if (key === 'user-agent') return value === '*';
  pushRule(active, key, value, rules);
  return active;
}

function pushRule(active: boolean, key: string, value: string, rules: Rule[]): void {
  if (!active || value.length === 0) return;
  if (key === 'allow') rules.push({ allow: true, pattern: value });
  if (key === 'disallow') rules.push({ allow: false, pattern: value });
}

function ruleMatches(pattern: string, path: string): boolean {
  const body = pattern.split('*').map(escapeRegExp).join('[^/]*');
  return new RegExp(`^${body}`).test(path);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
