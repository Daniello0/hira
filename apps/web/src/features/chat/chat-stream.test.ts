import { describe, expect, it, vi } from 'vitest';
import { readEventStream } from './chat-stream';

describe('readEventStream', () => {
  it('reads events until the body closes', async () => {
    const onEvent = vi.fn();
    await readEventStream(new Response('event: token\ndata: {"delta":"Hi"}\n\n'), onEvent);
    expect(onEvent).toHaveBeenCalledWith({ event: 'token', data: { delta: 'Hi' } });
  });

  it('gives up on a stream that goes quiet', async () => {
    const silent = new Response(new ReadableStream<Uint8Array>({ start: () => undefined }));
    await expect(readEventStream(silent, vi.fn(), 20)).rejects.toThrow('quiet');
  });
});
