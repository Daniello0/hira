import { IngestionStatus, VacancySource } from '@hira/contracts';
import type { RunRecord, RunWriter } from './run-writer';
import type { SqlClient } from './sql-client';

export interface RunFinish {
  status: IngestionStatus;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: unknown;
  finishedAt: Date;
}

/** Reads and writes `ingestion_runs` with the same SQL client as the vacancy store. */
export function createPgRunStore(client: SqlClient): RunWriter & {
  finish(id: string, result: RunFinish): Promise<void>;
} {
  return {
    start: (source, jobType, at) => startRun(client, source, jobType, at),
    list: () => listRuns(client),
    get: (id) => getRun(client, id),
    finish: (id, result) => finishRun(client, id, result),
  };
}

async function startRun(
  client: SqlClient,
  source: VacancySource,
  jobType: string,
  at: Date,
): Promise<RunRecord> {
  const result = await client.query(
    `INSERT INTO ingestion_runs (source, job_type, started_at, status)
     VALUES ($1, $2, $3, 'RUNNING')
     RETURNING id::text AS id, source::text AS source, job_type AS "jobType",
       started_at AS "startedAt", finished_at AS "finishedAt", status::text AS status,
       fetched, created, updated, skipped, failed, errors`,
    [source, jobType, at],
  );
  return toRecord(result.rows[0]);
}

async function listRuns(client: SqlClient): Promise<RunRecord[]> {
  const result = await client.query(
    `SELECT id::text AS id, source::text AS source, job_type AS "jobType",
       started_at AS "startedAt", finished_at AS "finishedAt", status::text AS status,
       fetched, created, updated, skipped, failed, errors
     FROM ingestion_runs ORDER BY started_at DESC`,
  );
  return result.rows.map((row) => toRecord(row));
}

async function getRun(client: SqlClient, id: string): Promise<RunRecord | null> {
  const result = await client.query(
    `SELECT id::text AS id, source::text AS source, job_type AS "jobType",
       started_at AS "startedAt", finished_at AS "finishedAt", status::text AS status,
       fetched, created, updated, skipped, failed, errors
     FROM ingestion_runs WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row === undefined ? null : toRecord(row);
}

async function finishRun(client: SqlClient, id: string, result: RunFinish): Promise<void> {
  await client.query(
    `UPDATE ingestion_runs SET finished_at = $2, status = $3, fetched = $4, created = $5,
       updated = $6, skipped = $7, failed = $8, errors = $9 WHERE id = $1`,
    [
      id,
      result.finishedAt,
      result.status,
      result.fetched,
      result.created,
      result.updated,
      result.skipped,
      result.failed,
      result.errors === null ? null : JSON.stringify(result.errors),
    ],
  );
}

function toRecord(row: Record<string, unknown> | undefined): RunRecord {
  if (row === undefined) throw new Error('ingestion run was not returned');
  return {
    id: String(row.id),
    source: String(row.source) as VacancySource,
    jobType: String(row.jobType),
    startedAt: new Date(String(row.startedAt)).toISOString(),
    finishedAt:
      row.finishedAt === null || row.finishedAt === undefined
        ? null
        : new Date(String(row.finishedAt)).toISOString(),
    status: String(row.status) as IngestionStatus,
    fetched: Number(row.fetched),
    created: Number(row.created),
    updated: Number(row.updated),
    skipped: Number(row.skipped),
    failed: Number(row.failed),
    errors: row.errors ?? null,
  };
}
