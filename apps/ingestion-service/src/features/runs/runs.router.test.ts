import { IngestionStatus, VacancySource } from '@hira/contracts';
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
    expect(queued).toEqual([{ source: VacancySource.RabotaBy, jobType: JOB_INCREMENTAL, runId: 'run-1' }]);
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
      .send({ source: VacancySource.Gsz, jobType: 'EMBED' });
    expect(job.status).toBe(400);
    const missing = await request(app)
      .get('/internal/v1/runs/missing')
      .set('X-Internal-Token', 'secret');
    expect(missing.status).toBe(404);
    expect(missing.body.errorCode).toBe('NOT_FOUND');
  });
});
