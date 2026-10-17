import { IngestionStatus } from '@hira/contracts';
import { assertDetailsAllowed, checkAlive } from '../connectors/check-alive';
import {
  collectSource,
  paceRequests,
  type CollectFailure,
  type CollectInput,
  type HttpGet,
} from '../connectors/collect-source';
import type { RawVacancy } from '../connectors/raw-vacancy';
import { JOB_LIVENESS, LIVENESS_BATCH_SIZE } from '../ingestion.constants';
import { normalizeVacancy } from '../normalize/normalize-vacancy';
import type { IngestJob } from '../scheduler/schedules';
import { applyLiveness, listActiveVacancies, type ActiveVacancy } from './pg-liveness';
import type { RunFinish } from './pg-run.store';
import { createPgVacancyStore } from './pg-vacancy.store';
import type { SqlClient } from './sql-client';

export interface RunItemError {
  message: string;
  externalId?: string;
}

export interface PerformInput {
  job: IngestJob;
  client: SqlClient;
  http: HttpGet;
  rates: Record<string, number>;
  rateError: string | null;
  limit: number;
  now: Date;
  pause?: () => Promise<void>;
}

interface Counts {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: RunItemError[];
}

/** Runs one queued job on a single SQL connection and returns the run counters. */
export async function performIngest(input: PerformInput): Promise<RunFinish> {
  if (input.job.jobType === JOB_LIVENESS) return checkLiveness(input);
  return collectJob(input);
}

async function checkLiveness(input: PerformInput): Promise<RunFinish> {
  const paced = paceRequests({ http: input.http, limit: input.limit, pause: input.pause });
  await assertDetailsAllowed(input.job.source, paced);
  const counts = emptyCounts(0);
  await checkBatches(input, paced, counts);
  const status = counts.failed > 0 ? IngestionStatus.Partial : IngestionStatus.Success;
  return done(status, counts, input.rateError, input.now);
}

async function checkBatches(
  input: PerformInput,
  paced: CollectInput,
  counts: Counts,
): Promise<void> {
  let afterId: string | null = null;
  for (;;) {
    const batch = await listActiveVacancies(
      input.client,
      input.job.source,
      afterId,
      LIVENESS_BATCH_SIZE,
    );
    if (batch.length === 0) return;
    for (const row of batch) await checkRow(input, paced, row, counts);
    const last = batch[batch.length - 1];
    if (last === undefined || batch.length < LIVENESS_BATCH_SIZE) return;
    afterId = last.id;
  }
}

async function checkRow(
  input: PerformInput,
  paced: CollectInput,
  row: ActiveVacancy,
  counts: Counts,
): Promise<void> {
  counts.fetched += 1;
  try {
    const verdict = await checkAlive(input.job.source, row.externalId, paced);
    await applyLiveness(input.client, row.id, verdict, input.now);
    counts.updated += 1;
  } catch (error) {
    counts.failed += 1;
    counts.errors.push({ externalId: row.externalId, message: errorMessage(error) });
  }
}

async function collectJob(input: PerformInput): Promise<RunFinish> {
  const collected = await collectSource(input.job.source, {
    http: input.http,
    limit: input.limit,
    pause: input.pause,
  });
  const counts = await writeCollected(input, collected.raws);
  rememberFailures(counts, collected.failures);
  const status =
    collected.truncated || counts.failed > 0 ? IngestionStatus.Partial : IngestionStatus.Success;
  return done(status, counts, input.rateError, input.now);
}

function rememberFailures(counts: Counts, failures: CollectFailure[]): void {
  for (const failure of failures) {
    counts.fetched += 1;
    counts.failed += 1;
    counts.errors.push(failure);
  }
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
  } catch (error) {
    counts.failed += 1;
    counts.errors.push({ externalId: raw.externalId, message: errorMessage(error) });
  }
}

function emptyCounts(updated: number): Counts {
  return { fetched: 0, created: 0, updated, skipped: 0, failed: 0, errors: [] };
}

function done(
  status: IngestionStatus,
  counts: Counts,
  rateError: string | null,
  now: Date,
): RunFinish {
  const { errors, ...counters } = counts;
  return { status, ...counters, errors: publishedErrors(rateError, errors), finishedAt: now };
}

function publishedErrors(
  rateError: string | null,
  itemErrors: RunItemError[],
): RunItemError[] | null {
  const errors = rateError === null ? itemErrors : [{ message: rateError }, ...itemErrors];
  return errors.length === 0 ? null : errors;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'vacancy failed';
}
