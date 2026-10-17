import { IngestionStatus, ReindexScope, VacancySource } from '@hira/contracts';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { JOB_INCREMENTAL } from '../ingestion.constants';
import { createRunsRouter } from './runs.router';
import type { IngestJob, IngestQueue } from '../scheduler/schedules';
import type { RunRecord, RunWriter } from '../store/run-writer';

const silent = pino({ level: 'silent' });

class MemoryRuns implements RunWriter {
  rows: RunRecord[] = [];

  async start(source: VacancySource, jobType: string, at: Date): Promise<RunRecord> {
    const row: RunRecord = {
      id: `run-${this.rows.length + 1}`,
      source,
      jobType,
      startedAt: at.toISOString(),
      finishedAt: null,
      status: IngestionStatus.Running,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: null,
    };
    this.rows.push(row);
    return row;
  }

  async list(): Promise<RunRecord[]> {
    return this.rows;
  }

  async get(id: string): Promise<RunRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }
}

function appWith(queue: IngestQueue, runs: RunWriter) {
  return createApp({
    logger: silent,
    internalToken: 'secret',
    probes: [],
    internalRouter: createRunsRouter({
      runs,
      queue,
      now: () => new Date('2026-10-11T12:00:00Z'),
    }),
  });
}

describe('ingestion runs API', () => {
  it('starts a run for a stage-7 source and lists it', async () => {
    const queued: IngestJob[] = [];
    const runs = new MemoryRuns();
    const app = appWith(
      {
        add: async (job) => {
          queued.push(job);
        },
      },
      runs,
    );
    const created = await request(app)
      .post('/internal/v1/runs')
      .set('X-Internal-Token', 'secret')
      .send({ source: VacancySource.RabotaBy, jobType: JOB_INCREMENTAL });
    expect(created.status).toBe(202);
    expect(created.body.status).toBe(IngestionStatus.Running);
    expect(queued).toEqual([
      { source: VacancySource.RabotaBy, jobType: JOB_INCREMENTAL, runId: 'run-1' },
    ]);
    const list = await request(app).get('/internal/v1/runs').set('X-Internal-Token', 'secret');
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    const one = await request(app).get('/internal/v1/runs/run-1').set('X-Internal-Token', 'secret');
    expect(one.status).toBe(200);
    expect(one.body.id).toBe('run-1');
  });

  it('rejects a later source, an unknown job, and a missing run', async () => {
    const app = appWith({ add: async () => undefined }, new MemoryRuns());
    const linkedin = await request(app)
      .post('/internal/v1/runs')
      .set('X-Internal-Token', 'secret')
      .send({ source: VacancySource.LinkedIn, jobType: JOB_INCREMENTAL });
    expect(linkedin.status).toBe(400);
    expect(linkedin.body.errorCode).toBe('VALIDATION_FAILED');
    const job = await request(app)
      .post('/internal/v1/runs')
      .set('X-Internal-Token', 'secret')
      .send({ source: VacancySource.Gsz, jobType: 'NOPE' });
    expect(job.status).toBe(400);
    const missing = await request(app)
      .get('/internal/v1/runs/missing')
      .set('X-Internal-Token', 'secret');
    expect(missing.status).toBe(404);
    expect(missing.body.errorCode).toBe('NOT_FOUND');
  });

  it('starts a skill extraction run for a stage-7 source', async () => {
    const queued: IngestJob[] = [];
    const app = appWith(
      {
        add: async (job) => {
          queued.push(job);
        },
      },
      new MemoryRuns(),
    );
    const created = await request(app)
      .post('/internal/v1/runs')
      .set('X-Internal-Token', 'secret')
      .send({ source: VacancySource.HabrCareer, jobType: 'EXTRACT_SKILLS' });
    expect(created.status).toBe(202);
    expect(queued[0]?.jobType).toBe('EXTRACT_SKILLS');
  });

  it('clears vectors for an embeddings reindex and rejects an unknown scope', async () => {
    const scopes: string[] = [];
    const app = createApp({
      logger: silent,
      internalToken: 'secret',
      probes: [],
      internalRouter: createRunsRouter({
        runs: new MemoryRuns(),
        queue: { add: async () => undefined },
        now: () => new Date('2026-10-11T12:00:00Z'),
        reindex: async (command) => {
          scopes.push(command.scope);
          return 2;
        },
      }),
    });
    const ok = await request(app)
      .post('/internal/v1/reindex')
      .set('X-Internal-Token', 'secret')
      .send({
        scope: ReindexScope.Embeddings,
        vacancyIds: ['3f1c2c2e-4b3a-4d5e-8f70-123456789abc'],
      });
    expect(ok.status).toBe(202);
    expect(ok.body).toEqual({ updated: 2 });
    expect(scopes).toEqual([ReindexScope.Embeddings]);
    const bad = await request(app)
      .post('/internal/v1/reindex')
      .set('X-Internal-Token', 'secret')
      .send({ scope: 'CHUNKS' });
    expect(bad.status).toBe(400);
    expect(bad.body.errorCode).toBe('VALIDATION_FAILED');
    const brokenId = await request(app)
      .post('/internal/v1/reindex')
      .set('X-Internal-Token', 'secret')
      .send({ scope: ReindexScope.All, vacancyIds: ['not-a-uuid'] });
    expect(brokenId.status).toBe(400);
  });
});
