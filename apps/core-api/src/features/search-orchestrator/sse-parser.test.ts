import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse-parser';

describe('sse parser', () => {
  it('reads events that arrive in partial chunks', () => {
    const parser = createSseParser();
    expect(parser.push('event: token\ndata: {"del')).toEqual([]);
    expect(parser.push('ta":"Hi"}\n\nevent: done\ndata: {"ok":true}\n\n')).toEqual([
      { event: 'token', data: { delta: 'Hi' } },
      { event: 'done', data: { ok: true } },
    ]);
  });
});
