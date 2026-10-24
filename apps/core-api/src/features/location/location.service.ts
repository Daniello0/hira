import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { formatLocationLabel, type LocationDto } from '@hira/contracts';
import { DataSource } from 'typeorm';
import { typeormRows } from '../database/typeorm-rows';
import { LOCATION_PAGE_SIZE } from './location.constants';

const LOCATIONS_SQL = `SELECT id, region, city FROM locations
  WHERE $1::text IS NULL OR city ILIKE $1 ESCAPE '\\' OR region ILIKE $1 ESCAPE '\\'
  ORDER BY region, city NULLS FIRST, id
  LIMIT $2`;

/** Cities and regions for the profile picker. */
@Injectable()
export class LocationService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Up to 50 places whose city or region contains `query`, ignoring case. Empty `query` lists the first page. */
  async search(query: string | undefined): Promise<LocationDto[]> {
    const rows = typeormRows(await this.dataSource.query(LOCATIONS_SQL, [likePattern(query), LOCATION_PAGE_SIZE]));
    return rows.map(toLocation);
  }
}

function likePattern(query: string | undefined): string | null {
  const text = query?.trim() ?? '';
  if (text.length === 0) return null;
  return `%${text.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}

function toLocation(row: Record<string, unknown>): LocationDto {
  const region = String(row.region);
  const city = typeof row.city === 'string' && row.city.trim().length > 0 ? row.city : null;
  return { id: Number(row.id), label: formatLocationLabel(city, region) ?? region, region, city };
}
