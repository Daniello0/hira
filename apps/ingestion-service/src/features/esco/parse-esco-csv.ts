export interface EscoSkillRow {
  uri: string;
  label: string;
  kind: 'skill' | 'group';
  escoSkillType: string | null;
  altLabels: string[];
  description: string | null;
}

export interface EscoOccupationRow {
  uri: string;
  label: string;
  kind: 'occupation' | 'group';
  description: string | null;
}

export interface OccupationSkillLink {
  occupationUri: string;
  skillUri: string;
  relation: 'essential' | 'optional';
}

/** Reads the skills classification CSV. `escoSkillType` stays the ESCO string. */
export function parseEscoSkills(csv: string): EscoSkillRow[] {
  return parseTable(csv).flatMap(readSkill);
}

/** Reads the occupations classification CSV, including groups. */
export function parseEscoOccupations(csv: string): EscoOccupationRow[] {
  return parseTable(csv).flatMap(readOccupation);
}

/** Reads occupation-skill relations. Unknown relation types are omitted. */
export function parseOccupationSkillRelations(csv: string): OccupationSkillLink[] {
  return parseTable(csv).flatMap(readLink);
}

/** Reads a collection file down to concept URIs. */
export function parseEscoCollection(csv: string): string[] {
  return parseTable(csv)
    .map((row) => field(row, 'concepturi'))
    .filter((uri) => uri.length > 0);
}

function readSkill(row: Record<string, string>): EscoSkillRow[] {
  const uri = field(row, 'concepturi');
  const label = field(row, 'preferredlabel') || field(row, 'conceptpt');
  const kind = skillKind(field(row, 'concepttype'));
  if (uri.length === 0 || label.length === 0 || kind === null) return [];
  return [
    {
      uri,
      label,
      kind,
      escoSkillType: emptyToNull(field(row, 'skilltype')),
      altLabels: splitLabels(field(row, 'altlabels')),
      description: emptyToNull(field(row, 'definition') || field(row, 'description')),
    },
  ];
}

function readOccupation(row: Record<string, string>): EscoOccupationRow[] {
  const uri = field(row, 'concepturi');
  const label = field(row, 'preferredlabel') || field(row, 'conceptpt');
  const kind = occupationKind(field(row, 'concepttype'));
  if (uri.length === 0 || label.length === 0 || kind === null) return [];
  return [
    {
      uri,
      label,
      kind,
      description: emptyToNull(field(row, 'definition') || field(row, 'description')),
    },
  ];
}

function readLink(row: Record<string, string>): OccupationSkillLink[] {
  const relation = field(row, 'relationtype').toLowerCase();
  const occupationUri = field(row, 'occupationuri');
  const skillUri = field(row, 'skilluri');
  if (relation !== 'essential' && relation !== 'optional') return [];
  if (occupationUri.length === 0 || skillUri.length === 0) return [];
  return [{ occupationUri, skillUri, relation }];
}

function skillKind(value: string): 'skill' | 'group' | null {
  const token = value.toUpperCase();
  if (token === 'SK' || token === 'SKILL') return 'skill';
  if (token === 'SG' || token === 'GROUP') return 'group';
  return null;
}

function occupationKind(value: string): 'occupation' | 'group' | null {
  const token = value.toUpperCase();
  if (token === 'OC' || token === 'OCCUPATION') return 'occupation';
  if (token === 'OG' || token === 'GROUP') return 'group';
  return null;
}

function splitLabels(value: string): string[] {
  if (value.length === 0) return [];
  return value
    .split(/[|\n]/)
    .map((label) => label.trim())
    .filter((label) => label.length > 0);
}

function emptyToNull(value: string): string | null {
  return value.length === 0 ? null : value;
}

function field(row: Record<string, string>, name: string): string {
  return row[name]?.trim() ?? '';
}

function parseTable(csv: string): Array<Record<string, string>> {
  const table = splitCsv(csv);
  const header = table[0];
  if (header === undefined) return [];
  const names = header.map(headerName);
  return table.slice(1).map((cells) => zipRow(names, cells));
}

function headerName(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '');
}

function zipRow(names: string[], cells: string[]): Record<string, string> {
  const row: Record<string, string> = {};
  names.forEach((name, index) => {
    row[name] = cells[index]?.trim() ?? '';
  });
  return row;
}

function splitCsv(csv: string): string[][] {
  return csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(splitLine);
}

function splitLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (const char of line) {
    const step = takeChar(char, quoted, current);
    current = step.current;
    quoted = step.quoted;
    if (step.cell !== null) cells.push(step.cell);
  }
  cells.push(current);
  return cells;
}

function takeChar(
  char: string,
  quoted: boolean,
  current: string,
): { current: string; quoted: boolean; cell: string | null } {
  if (char === '"') return { current, quoted: !quoted, cell: null };
  if (char === ',' && !quoted) return { current: '', quoted, cell: current };
  return { current: current + char, quoted, cell: null };
}
