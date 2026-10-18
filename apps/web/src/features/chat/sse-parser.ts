export interface ParsedSse {
  event: string;
  data: unknown;
}

/** Incremental SSE reader. Events are separated by a blank line. */
export function createSseParser(): { push(chunk: string): ParsedSse[] } {
  let buffer = '';
  return {
    push(chunk: string): ParsedSse[] {
      buffer += chunk;
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      return blocks.flatMap(parseBlock);
    },
  };
}

function parseBlock(block: string): ParsedSse[] {
  const event = readField(block, 'event');
  const data = readField(block, 'data');
  if (event === null || data === null) return [];
  return [{ event, data: parseData(data) }];
}

function readField(block: string, name: string): string | null {
  const line = block.split('\n').find((item) => item.startsWith(`${name}:`));
  if (line === undefined) return null;
  return line.slice(name.length + 1).trim();
}

function parseData(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return data;
  }
}
