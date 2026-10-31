/** One style written outside `src/styles`. */
export interface StyleViolation {
  rule: string;
  match: string;
}

const VARIANT_PREFIXES = ['data-', 'aria-', 'group-data-', 'group-aria-', 'peer-data-', 'peer-aria-', 'has-', 'not-', 'supports-', 'min-', 'max-'];
const PALETTE = 'white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const COLOR_UTILITY = 'bg|text|border|ring|fill|stroke|divide|outline|from|via|to|shadow|accent|caret|decoration|placeholder';

const LITERAL_RULES: readonly { rule: string; pattern: RegExp }[] = [
  { rule: 'hex color', pattern: /#[0-9a-fA-F]{3,8}\b/g },
  { rule: 'color function', pattern: /\b(?:rgba?|hsla?|oklch|oklab)\(/g },
  { rule: 'Tailwind palette', pattern: new RegExp(`\\b(?:${COLOR_UTILITY})-(?:${PALETTE})\\b(?:-\\d+)?`, 'g') },
  { rule: 'old token', pattern: /\b[a-z]+-hira-[a-z]+/g },
  { rule: 'icon size', pattern: /\bsize=\{/g },
  { rule: 'inline style', pattern: /style=\{\{[^}]*\b(?:color|background|backgroundColor|border|borderColor|fontSize|fontFamily|boxShadow|borderRadius|transition|animation|padding|margin)\b/g },
];

/** Finds styles a component must take from `src/styles`. Data-driven `width` in a `style` prop is allowed. */
export function findStyleViolations(source: string): StyleViolation[] {
  const found: StyleViolation[] = [];
  for (const { rule, pattern } of LITERAL_RULES) {
    for (const match of source.matchAll(pattern)) found.push({ rule, match: match[0] });
  }
  return [...found, ...arbitraryValues(source)];
}

function arbitraryValues(source: string): StyleViolation[] {
  const found: StyleViolation[] = [];
  for (const match of source.matchAll(/(?<![\w-])((?:[a-z]+-)+)\[[^\]\s'"`]+\]/g)) {
    const prefix = match[1] ?? '';
    if (!VARIANT_PREFIXES.some((variant) => prefix.startsWith(variant) && prefix === variant)) {
      found.push({ rule: 'arbitrary value', match: match[0] });
    }
  }
  return found;
}

/** WCAG contrast ratio of two `#rrggbb` colors. */
export function contrastRatio(first: string, second: string): number {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = channels.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** Reads `--name: #hex` pairs of one theme block from `tokens.css`. */
export function readThemeBlock(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) return {};
  const block = css.slice(start, css.indexOf('}', start));
  const entries = [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2]] as const);
  return Object.fromEntries(entries);
}
