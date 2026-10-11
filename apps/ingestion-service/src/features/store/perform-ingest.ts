import { IngestionStatus } from '@hira/contracts';
import { collectSource, type HttpGet } from '../connectors/collect-source';
import type { RawVacancy } from '../connectors/raw-vacancy';
import { HOUR_MS, JOB_LIVENESS, STALE_THRESHOLD_HOURS } from '../ingestion.constants';
import { normalizeVacancy } from '../normalize/normalize-vacancy';
import type { IngestJob } from '../scheduler/schedules';
import { expireSource, type RunFinish } from './pg-run.store';
import { createPgVacancyStore } from './pg-vacancy.store';
import type { SqlClient } from './sql-client';

export interface PerformInput {
  job: IngestJob;
  client: SqlClient;
  http: HttpGet;
  rates: Record<string, number>;
  limit: number;
  now: Date;
}

interface Counts {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

/** Runs one queued job on a single SQL connection and returns the run counters. */
export async function performIngest(input: PerformInput): Promise<RunFinish> {
  if (input.job.jobType === JOB_LIVENESS) return expireJob(input);
  return collectJob(input);
}

async function expireJob(input: PerformInput): Promise<RunFinish> {
  const cutoff = new Date(input.now.getTime() - STALE_THRESHOLD_HOURS * HOUR_MS);
  const updated = await expireSource(input.client, input.job.source, cutoff);
  return done(IngestionStatus.Success, emptyCounts(updated), null, input.now);
}

async function collectJob(input: PerformInput): Promise<RunFinish> {
  const collected = await collectSource(input.job.source, { http: input.http, limit: input.limit });
  const counts = await writeCollected(input, collected.raws);
  const status =
    collected.truncated || counts.failed > 0 ? IngestionStatus.Partial : IngestionStatus.Success;
  return done(status, counts, null, input.now);
}

async function writeCollected(input: PerformInput, raws: RawVacancy[]): Promise<Counts> {
  const store = createPgVacancyStore(input.client);
  const counts = emptyCounts(0);
  counts.fetched = raws.length;
  for (const raw of raws) await writeOne(store, input, raw, counts);
  return counts;
}

async function writeOne(
  store: ReturnType<typeof createPgVacancyStore>,
  input: PerformInput,
  raw: RawVacancy,
  counts: Counts,
): Promise<void> {
  try {
    const saved = await store.save(normalizeVacancy(raw, input.rates, input.job.source), input.now);
    if (saved.outcome === 'created') counts.created += 1;
    else if (saved.outcome === 'updated') counts.updated += 1;
    else counts.skipped += 1;
  } catch {
    counts.failed += 1;
  }
}

function emptyCounts(updated: number): Counts {
  return { fetched: 0, created: 0, updated, skipped: 0, failed: 0 };
}

function done(status: IngestionStatus, counts: Counts, errors: unknown, now: Date): RunFinish {
  return { status, ...counts, errors, finishedAt: now };
}
