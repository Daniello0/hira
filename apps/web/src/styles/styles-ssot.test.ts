import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contrastRatio, findStyleViolations, readThemeBlock } from './style-rules';
import { THEME_SURFACE } from './theme-colors';

const STYLES_DIR = dirname(fileURLToPath(import.meta.url));
const SRC_DIR = join(STYLES_DIR, '..');
const TOKENS = readFileSync(join(STYLES_DIR, 'tokens.css'), 'utf8');
const MOTION = readFileSync(join(STYLES_DIR, 'motion.css'), 'utf8');
const AA_TEXT = 4.5;

const TEXT_PAIRS: readonly [string, string][] = [
  ['ink', 'surface'],
  ['ink-secondary', 'surface'],
  ['ink-tertiary', 'surface'],
  ['ink', 'surface-card'],
  ['ink-tertiary', 'surface-raised'],
  ['on-accent', 'accent'],
  ['on-bubble', 'bubble'],
  ['on-primary', 'primary'],
  ['on-accent-soft', 'accent-soft'],
  ['link', 'surface'],
  ['danger', 'surface'],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return path === STYLES_DIR ? [] : sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('single home for styles', () => {
  it('finds nothing outside src/styles', () => {
    const found = sourceFiles(SRC_DIR).flatMap((path) =>
      findStyleViolations(readFileSync(path, 'utf8')).map((violation) => `${relative(SRC_DIR, path)}: ${violation.rule}: ${violation.match}`),
    );
    expect(found).toEqual([]);
  });

  it.each([
    ['hex', 'color: "#ff0000"'],
    ['rgb', 'rgba(0, 0, 0, 0.5)'],
    ['palette', 'className="bg-white/10 text-red-300"'],
    ['arbitrary', 'className="w-[34rem]"'],
    ['old token', 'className="bg-hira-bg"'],
    ['inline color', 'style={{ color: value }}'],
  ])('catches a bad line: %s', (_name, line) => {
    expect(findStyleViolations(line).length).toBeGreaterThan(0);
  });

  it.each([
    'className="data-[state=open]:bg-hover aria-[pressed=true]:text-ink"',
    'style={{ width: `${bar.width}%` }}',
    'href="#message"',
    'className="w-sidebar bg-surface-card rounded-bubble"',
  ])('allows: %s', (line) => {
    expect(findStyleViolations(line)).toEqual([]);
  });

  it('clears Tailwind scales, so a default class does not build', () => {
    for (const scale of ['--color-*: initial', '--radius-*: initial', '--text-*: initial', '--shadow-*: initial', '--font-*: initial', '--container-*: initial']) {
      expect(TOKENS).toContain(scale);
    }
  });

  it('keeps globals.css as imports only', () => {
    const lines = readFileSync(join(SRC_DIR, 'app/globals.css'), 'utf8').trim().split('\n');
    expect(lines.every((line) => line.startsWith('@import'))).toBe(true);
  });

  it('keeps the manifest and browser color equal to the tokens', () => {
    expect(readThemeBlock(TOKENS, "[data-theme='dark']").surface).toBe(THEME_SURFACE.dark);
    expect(readThemeBlock(TOKENS, "[data-theme='light']").surface).toBe(THEME_SURFACE.light);
  });
});

describe('text contrast', () => {
  it.each(["[data-theme='dark']", "[data-theme='light']"])('reaches AA in %s', (selector) => {
    const theme = readThemeBlock(TOKENS, selector);
    const failing = TEXT_PAIRS.filter(([text, back]) => contrastRatio(theme[text] ?? '#000000', theme[back] ?? '#000000') < AA_TEXT);
    expect(failing).toEqual([]);
  });
});

describe('motion', () => {
  it('pairs every overlay opening with a closing', () => {
    for (const name of ['motion-menu', 'motion-scrim', 'motion-dialog', 'motion-sheet-left', 'motion-sheet-right', 'motion-collapsible']) {
      expect(MOTION).toContain(`.${name}[data-state='open']`);
      expect(MOTION).toContain(`.${name}[data-state='closed']`);
    }
  });

  it('turns motion off for people who ask for that', () => {
    expect(MOTION).toContain('@media (prefers-reduced-motion: reduce)');
  });
});
