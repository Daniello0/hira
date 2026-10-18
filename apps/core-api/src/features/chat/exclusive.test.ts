import { describe, expect, it } from 'vitest';
import { exclusive, exclusiveQueueSize } from './exclusive';

describe('exclusive', () => {
  it('runs one key at a time and forgets the key when the queue is idle', async () => {
    const order: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = exclusive('demo-a', async () => {
      order.push('first');
      await gate;
    });
    const second = exclusive('demo-a', async () => {
      order.push('second');
    });
    expect(exclusiveQueueSize()).toBe(1);
    release();
    await first;
    await second;
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['first', 'second']);
    expect(exclusiveQueueSize()).toBe(0);
  });
});
