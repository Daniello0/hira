import { describe, expect, it } from 'vitest';
import { CHUNK_WINDOW_CHARS, splitDescription } from './split-description';

describe('splitDescription', () => {
  it('returns nothing for an empty description', () => {
    expect(splitDescription(null)).toEqual([]);
    expect(splitDescription(undefined)).toEqual([]);
    expect(splitDescription('')).toEqual([]);
    expect(splitDescription('  \n  ')).toEqual([]);
  });

  it('keeps one short paragraph as chunk 0 and counts tokens from its length', () => {
    expect(splitDescription('Python')).toEqual([
      { chunkIndex: 0, content: 'Python', tokenCount: 2 },
    ]);
  });

  it('splits paragraphs on a blank line', () => {
    expect(splitDescription('one\n\ntwo')).toEqual([
      { chunkIndex: 0, content: 'one', tokenCount: 1 },
      { chunkIndex: 1, content: 'two', tokenCount: 1 },
    ]);
  });

  it('cuts a long paragraph on the window without overlap', () => {
    const text = 'a'.repeat(CHUNK_WINDOW_CHARS + 1);
    const chunks = splitDescription(text);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]?.content).toHaveLength(CHUNK_WINDOW_CHARS);
    expect(chunks[1]?.content).toBe('a');
    expect(`${chunks[0]?.content ?? ''}${chunks[1]?.content ?? ''}`).toBe(text);
    expect(chunks[1]?.chunkIndex).toBe(1);
    expect(chunks[0]?.tokenCount).toBe(CHUNK_WINDOW_CHARS / 4);
  });
});
