import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module';
import { HEALTH_PROBES } from './health.constants';
import type { DependencyProbe } from './health.types';

describe('core-api health', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('answers liveness and echoes a request id', async () => {
    app = await createApp([]);
    const response = await request(app.getHttpServer()).get('/health').set('X-Request-Id', 'req-7');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['x-request-id']).toBe('req-7');
  });

  it('returns 503 when a dependency is down', async () => {
    app = await createApp([{ name: 'postgres', check: async () => false }]);
    const response = await request(app.getHttpServer()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body.errorCode).toBe('NOT_READY');
    expect(response.body.details.checks.postgres).toBe('down');
  });
});

async function createApp(probes: readonly DependencyProbe[]): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HEALTH_PROBES)
    .useValue(probes)
    .compile();
  const application = moduleRef.createNestApplication({ logger: false });
  await application.init();
  return application;
}
