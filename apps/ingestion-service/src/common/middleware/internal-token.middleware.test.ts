import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { requestIdMiddleware } from './request-id.middleware';
import { internalTokenMiddleware } from './internal-token.middleware';

const silentLogger = pino({ level: 'silent' });

describe('internal token', () => {
  it('allows health checks without a token', async () => {
    const app = createApp({ logger: silentLogger, internalToken: 'secret', probes: [] });
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('rejects a protected route when the token does not match', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.use(internalTokenMiddleware('secret'));
    app.get('/internal/v1/search', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const response = await request(app).get('/internal/v1/search').set('X-Internal-Token', 'nope');
    expect(response.status).toBe(401);
    expect(response.body.errorCode).toBe('INTERNAL_TOKEN_INVALID');
  });

  it('returns 503 when a dependency is down', async () => {
    const app = createApp({
      logger: silentLogger,
      internalToken: 'secret',
      probes: [{ name: 'postgres', check: async () => false }],
    });
    const response = await request(app).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.errorCode).toBe('NOT_READY');
    expect(response.body.details.checks.postgres).toBe('down');
  });
});
