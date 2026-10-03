import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';
import { probeTcp } from './probe-tcp';

describe('probeTcp', () => {
  it('resolves true when a local port accepts a connection', async () => {
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('expected a TCP address');
    }
    await expect(probeTcp('127.0.0.1', address.port, 1000)).resolves.toBe(true);
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it('resolves false when nothing is listening', async () => {
    await expect(probeTcp('127.0.0.1', 1, 200)).resolves.toBe(false);
  });
});
