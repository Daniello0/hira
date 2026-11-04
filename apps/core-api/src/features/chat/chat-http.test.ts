import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { responseSink } from './chat-http';

class FakeResponse extends EventEmitter {
  written: string[] = [];
  destroyed = false;
  writableEnded = false;
  status = () => this;
  setHeader = () => this;
  write = (chunk: string) => this.written.push(chunk) > 0;
}

describe('responseSink', () => {
  afterEach(() => vi.useRealTimers());

  it('keeps a quiet stream alive with comment lines until the response closes', () => {
    vi.useFakeTimers();
    const response = new FakeResponse();
    const sink = responseSink(response as unknown as Response);
    sink.open();
    vi.advanceTimersByTime(31_000);
    expect(response.written).toEqual([': keep-alive\n\n', ': keep-alive\n\n']);
    sink.write('done', {});
    response.emit('close');
    vi.advanceTimersByTime(60_000);
    expect(response.written).toHaveLength(3);
    expect(response.written[2]).toBe('event: done\ndata: {}\n\n');
  });
});
