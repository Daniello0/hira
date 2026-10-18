import { describe, expect, it } from 'vitest';
import { createSseParser } from './sse-parser';

describe('createSseParser', () => {
  it('joins a frame split across chunks', () => {
    const parser = createSseParser();
    expect(parser.push('event: token\ndata: {"del')).toEqual([]);
    expect(parser.push('ta":"Hi"}\n\n')).toEqual([{ event: 'token', data: { delta: 'Hi' } }]);
  });

  it('returns two frames from one chunk', () => {
    const parser = createSseParser();
    const chunk = 'event: token\ndata: {"delta":"A"}\n\nevent: done\ndata: {"ok":true}\n\n';
    expect(parser.push(chunk)).toEqual([
      { event: 'token', data: { delta: 'A' } },
      { event: 'done', data: { ok: true } },
    ]);
  });

  it('keeps a frame when the JSON is broken', () => {
    const parser = createSseParser();
    expect(parser.push('event: token\ndata: {nope}\n\n')).toEqual([{ event: 'token', data: '{nope}' }]);
  });
});
