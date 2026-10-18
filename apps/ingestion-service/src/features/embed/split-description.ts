/** Character window standing in for a 512-token slice. */
export const CHUNK_WINDOW_CHARS = 2048;

/** Rough characters per token until a BGE tokenizer is part of the pipeline. */
export const CHARS_PER_TOKEN = 4;

export interface DescriptionChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

const PARAGRAPH_BREAK = /\n\s*\n/;

/** Splits a vacancy description into non-overlapping slices. An empty text yields none. */
export function splitDescription(description: string | null | undefined): DescriptionChunk[] {
  return paragraphsOf(description).flatMap(cutParagraph).map(toChunk);
}

function paragraphsOf(description: string | null | undefined): string[] {
  if (description == null) return [];
  return description
    .split(PARAGRAPH_BREAK)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function cutParagraph(paragraph: string): string[] {
  if (paragraph.length <= CHUNK_WINDOW_CHARS) return [paragraph];
  const parts: string[] = [];
  for (let start = 0; start < paragraph.length; start += CHUNK_WINDOW_CHARS) {
    parts.push(paragraph.slice(start, start + CHUNK_WINDOW_CHARS));
  }
  return parts;
}

function toChunk(content: string, chunkIndex: number): DescriptionChunk {
  return { chunkIndex, content, tokenCount: Math.ceil(content.length / CHARS_PER_TOKEN) };
}
