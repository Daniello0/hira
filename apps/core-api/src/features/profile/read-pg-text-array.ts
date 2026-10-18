/** Reads `text[]` or a Postgres array literal. node-pg leaves enum arrays as `{A,B}`. */
export function readPgTextArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value !== 'string') return [];
  return parseLiteral(value);
}

function parseLiteral(literal: string): string[] {
  if (!literal.startsWith('{') || !literal.endsWith('}')) return [];
  const body = literal.slice(1, -1).trim();
  if (body.length === 0) return [];
  return body.split(',').map(stripToken).filter(isValue);
}

function stripToken(token: string): string {
  const trimmed = token.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed;
  return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function isValue(token: string): boolean {
  return token.length > 0 && token !== 'NULL';
}
