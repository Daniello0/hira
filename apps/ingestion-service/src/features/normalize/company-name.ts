const LEGAL_FORMS = new Set([
  'ооо',
  'оао',
  'зао',
  'одо',
  'пао',
  'ао',
  'руп',
  'уп',
  'ип',
  'odo',
  'jsc',
]);

/** Lower-case name without quotes and legal-form tokens. */
export function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[«»"']/g, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 0 && !LEGAL_FORMS.has(word))
    .join(' ');
}
