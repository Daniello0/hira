import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { UserRole, type IngestionRunDto, type IngestionStatus, type VacancySource } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { USER_STORE, type UserStore } from '../auth/user.store';
import { typeormRows } from '../database/typeorm-rows';
import { AdminRequiredError } from './admin.errors';

const RUNS_SQL = `SELECT id::text AS id, source::text AS source, job_type AS "jobType", status::text AS status,
  started_at AS "startedAt", finished_at AS "finishedAt", fetched, created, updated, skipped, failed, errors
  FROM ingestion_runs
  ORDER BY started_at DESC, id DESC
  LIMIT $1`;

/** Operator views. Every method checks the role stored on the account. */
@Injectable()
export class AdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(USER_STORE) private readonly users: UserStore,
  ) {}

  /** Throws `AdminRequiredError` unless `users.role` is ADMIN. */
  async assertAdmin(userId: string): Promise<void> {
    const account = await this.users.findById(userId);
    if (account?.role !== UserRole.Admin) throw new AdminRequiredError();
  }

  /** Newest ingestion runs first. */
  async runs(limit: number): Promise<IngestionRunDto[]> {
    return typeormRows(await this.dataSource.query(RUNS_SQL, [limit])).map(toRun);
  }
}

function toRun(row: Record<string, unknown>): IngestionRunDto {
  return {
    id: String(row.id),
    source: String(row.source) as VacancySource,
    jobType: String(row.jobType),
    status: String(row.status) as IngestionStatus,
    startedAt: isoOf(row.startedAt) ?? '',
    finishedAt: isoOf(row.finishedAt),
    fetched: Number(row.fetched ?? 0),
    created: Number(row.created ?? 0),
    updated: Number(row.updated ?? 0),
    skipped: Number(row.skipped ?? 0),
    failed: Number(row.failed ?? 0),
    errors: isRecord(row.errors) ? row.errors : null,
  };
}

function isoOf(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return new Date(value instanceof Date ? value : String(value)).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
