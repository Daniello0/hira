import { flattenWhitespace, stripHtml } from '../normalize/strip-html';

/** First capture group of the pattern, or null. */
export function matchOne(value: string, pattern: RegExp): string | null {
  return pattern.exec(value)?.[1] ?? null;
}

/** Visible one-line text of a short HTML fragment; a blank result is null. */
export function plainText(value: string | null | undefined): string | null {
  const text = flattenWhitespace(stripHtml(value ?? ''));
  return text.length === 0 ? null : text;
}

/** Inner HTML of the element whose opening tag contains `marker`, balancing nested divs. */
export function readInnerDiv(html: string, marker: string): string | null {
  const at = html.indexOf(marker);
  if (at < 0) return null;
  const open = html.indexOf('>', at);
  return open < 0 ? null : innerDiv(html, open + 1);
}

function innerDiv(html: string, start: number): string {
  const source = html.toLowerCase();
  let depth = 1;
  let cursor = start;
  while (cursor < html.length) {
    const next = nextDiv(source, cursor);
    if (next === null) return html.slice(start);
    depth += next.opens ? 1 : -1;
    if (depth === 0) return html.slice(start, next.at);
    cursor = next.cursor;
  }
  return html.slice(start);
}

function nextDiv(
  source: string,
  from: number,
): { at: number; opens: boolean; cursor: number } | null {
  const open = source.indexOf('<div', from);
  const close = source.indexOf('</div', from);
  if (close < 0) return null;
  if (open >= 0 && open < close) return { at: open, opens: true, cursor: open + 4 };
  return { at: close, opens: false, cursor: close + 6 };
}

/** Distinct values in first-seen order. */
export function distinctBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = key(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
