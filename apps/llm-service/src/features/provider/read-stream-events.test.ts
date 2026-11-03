import { describe, expect, it } from 'vitest';
import { readStreamEvents } from './read-stream-events';

async function* chunks(parts: readonly Buffer[]): AsyncGenerator<Buffer> {
  for (const part of parts) yield part;
}

async function deltas(parts: readonly Buffer[]): Promise<string> {
  let text = '';
  for await (const event of readStreamEvents(chunks(parts))) if (event.kind === 'delta') text += event.text;
  return text;
}

describe('readStreamEvents', () => {
  it('keeps a Cyrillic letter whole when the network splits its bytes between chunks', async () => {
    const frame = Buffer.from(`data: ${JSON.stringify({ choices: [{ delta: { content: 'не могу' } }] })}\n\ndata: [DONE]\n\n`);
    const split = frame.indexOf(Buffer.from('н')) + 1;
    expect(await deltas([frame.subarray(0, split), frame.subarray(split)])).toBe('не могу');
  });
});
