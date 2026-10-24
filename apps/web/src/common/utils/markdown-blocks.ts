/** One block of the small Markdown subset Hira writes. */
export type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'paragraph'; text: string };

const FENCE = /^```/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

/** Splits text into blocks. Nothing here produces HTML; the renderer builds React nodes. */
export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) index = readBlock(lines, index, blocks);
  return blocks;
}

function readBlock(lines: readonly string[], start: number, out: MarkdownBlock[]): number {
  const line = lines[start] ?? '';
  if (line.trim().length === 0) return start + 1;
  if (FENCE.test(line.trim())) return readCode(lines, start, out);
  const heading = HEADING.exec(line);
  if (heading !== null) {
    out.push({ kind: 'heading', level: heading[1]?.length ?? 1, text: heading[2] ?? '' });
    return start + 1;
  }
  if (BULLET.test(line)) return readList(lines, start, false, out);
  if (NUMBERED.test(line)) return readList(lines, start, true, out);
  return readParagraph(lines, start, out);
}

function readCode(lines: readonly string[], start: number, out: MarkdownBlock[]): number {
  let index = start + 1;
  const body: string[] = [];
  while (index < lines.length && !FENCE.test((lines[index] ?? '').trim())) {
    body.push(lines[index] ?? '');
    index += 1;
  }
  out.push({ kind: 'code', text: body.join('\n') });
  return index + 1;
}

function readList(lines: readonly string[], start: number, ordered: boolean, out: MarkdownBlock[]): number {
  const pattern = ordered ? NUMBERED : BULLET;
  const items: string[] = [];
  let index = start;
  while (index < lines.length) {
    const match = pattern.exec(lines[index] ?? '');
    if (match === null) break;
    items.push(match[1] ?? '');
    index += 1;
  }
  out.push({ kind: 'list', ordered, items });
  return index;
}

function readParagraph(lines: readonly string[], start: number, out: MarkdownBlock[]): number {
  const body: string[] = [];
  let index = start;
  while (index < lines.length && startsParagraphLine(lines[index] ?? '')) {
    body.push(lines[index] ?? '');
    index += 1;
  }
  out.push({ kind: 'paragraph', text: body.join('\n') });
  return index;
}

function startsParagraphLine(line: string): boolean {
  if (line.trim().length === 0) return false;
  return !FENCE.test(line.trim()) && !HEADING.test(line) && !BULLET.test(line) && !NUMBERED.test(line);
}
