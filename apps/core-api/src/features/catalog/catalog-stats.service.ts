import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { VacancyStatus, type CatalogStats, type VacancySource } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { typeormRows } from '../database/typeorm-rows';
import { CLOCK, type Clock } from '../../common/utils/clock';

const CACHE_MS = 5 * 60 * 1000;
const TOP_CITIES = 30;
const ACTIVE = `v.status = '${VacancyStatus.Active}'`;

const TOTALS_SQL = `SELECT count(*)::int AS total,
    (count(*) FILTER (WHERE v.location_id IS NULL))::int AS "noLocation",
    (count(*) FILTER (WHERE v.work_format = 'REMOTE'))::int AS remote,
    (count(*) FILTER (WHERE v.is_foreign_remote))::int AS "foreignRemote"
  FROM vacancies v WHERE ${ACTIVE}`;
const REGIONS_SQL = `SELECT l.region AS name, count(*)::int AS count
  FROM vacancies v JOIN locations l ON l.id = v.location_id
  WHERE ${ACTIVE} GROUP BY l.region ORDER BY count DESC, l.region`;
const CITIES_SQL = `SELECT l.city AS name, count(*)::int AS count
  FROM vacancies v JOIN locations l ON l.id = v.location_id
  WHERE ${ACTIVE} AND l.city IS NOT NULL GROUP BY l.city ORDER BY count DESC, l.city LIMIT ${TOP_CITIES}`;
const SOURCES_SQL = `SELECT v.source::text AS name, count(*)::int AS count
  FROM vacancies v WHERE ${ACTIVE} GROUP BY v.source ORDER BY count DESC, v.source`;

/** Counts of live vacancies for Hira's answers. The table is the source; this is a five-minute copy. */
@Injectable()
export class CatalogStatsService {
  private cached: { stats: CatalogStats; at: number } | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Fresh or cached counts. A failed read falls back to the last counts, or null, and never stops a turn. */
  async read(): Promise<CatalogStats | null> {
    const now = this.clock.now().getTime();
    if (this.cached !== null && now - this.cached.at < CACHE_MS) return this.cached.stats;
    try {
      const stats = await this.load();
      this.cached = { stats, at: now };
      return stats;
    } catch {
      return this.cached?.stats ?? null;
    }
  }

  private async load(): Promise<CatalogStats> {
    const [totals, regions, cities, sources] = await Promise.all([TOTALS_SQL, REGIONS_SQL, CITIES_SQL, SOURCES_SQL].map((sql) => this.rows(sql)));
    const head = totals?.[0] ?? {};
    return {
      total: Number(head.total ?? 0),
      noLocation: Number(head.noLocation ?? 0),
      remote: Number(head.remote ?? 0),
      foreignRemote: Number(head.foreignRemote ?? 0),
      byRegion: (regions ?? []).map((row) => ({ region: String(row.name), count: Number(row.count) })),
      topCities: (cities ?? []).map((row) => ({ city: String(row.name), count: Number(row.count) })),
      bySource: (sources ?? []).map((row) => ({ source: String(row.name) as VacancySource, count: Number(row.count) })),
    };
  }

  private async rows(sql: string): Promise<Record<string, unknown>[]> {
    return typeormRows(await this.dataSource.query(sql));
  }
}
