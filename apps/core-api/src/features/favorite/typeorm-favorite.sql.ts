import {
  AuthorKind,
  formatLocationLabel,
  removedVacancySummary,
  type CollectionDto,
  type FavoriteDto,
  type VacancyCardSummary,
  type VacancyStatus,
  type WorkFormat,
} from '@hira/contracts';
import type { Sql } from '../chat/typeorm-chat.sql';
import { isUniqueViolation } from './is-unique-violation';
import type { CollectionPatch, FavoriteListQuery, FavoritePatch, NewCollection, NewFavorite } from './favorite.store';

const FAVORITE_FROM = `FROM favorites f
  LEFT JOIN vacancies v ON v.id = f.vacancy_id
  LEFT JOIN locations l ON l.id = v.location_id`;

const FAVORITE_COLUMNS = `f.id::text AS id, f.vacancy_id::text AS "vacancyId", f.collection_id::text AS "collectionId",
  f.note, f.added_by::text AS "addedBy", f.created_at AS "createdAt",
  (v.id IS NULL) AS "vacancyMissing", v.title, v.company_name AS "companyName", v.status::text AS status, v.url,
  v.salary_min AS "salaryMin", v.salary_max AS "salaryMax", v.salary_currency AS "salaryCurrency",
  v.work_format::text AS "workFormat", v.is_foreign_remote AS "isForeignRemote",
  l.city AS "locationCity", l.region AS "locationRegion"`;

/** Lists saved vacancies for one account. */
export async function listFavorites(sql: Sql, userId: string, query: FavoriteListQuery): Promise<FavoriteDto[]> {
  const rows = await rowsOf(sql, `SELECT ${FAVORITE_COLUMNS} ${FAVORITE_FROM}
    WHERE f.user_id = $1
      AND ($2::uuid IS NULL OR f.collection_id = $2::uuid)
      AND ($3::text IS NULL OR position(lower($3) in lower(f.note)) > 0)
    ORDER BY f.created_at DESC, f.id`, [userId, query.collectionId ?? null, query.noteQuery ?? null]);
  return rows.map(toFavorite);
}

/** One saved vacancy, or null. */
export async function findFavoriteByVacancy(sql: Sql, userId: string, vacancyId: string): Promise<FavoriteDto | null> {
  const rows = await rowsOf(sql, `SELECT ${FAVORITE_COLUMNS} ${FAVORITE_FROM} WHERE f.user_id = $1 AND f.vacancy_id = $2`, [userId, vacancyId]);
  return rows[0] === undefined ? null : toFavorite(rows[0]);
}

/** Inserts a favorite. A unique (user, vacancy) pair returns the row already stored. */
export async function insertFavorite(sql: Sql, input: NewFavorite): Promise<FavoriteDto | null> {
  try {
    await rowsOf(
      sql,
      `INSERT INTO favorites (user_id, vacancy_id, collection_id, note, added_by) VALUES ($1, $2, $3, $4, $5)`,
      [input.userId, input.vacancyId, input.collectionId, input.note, input.addedBy],
    );
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return findFavoriteByVacancy(sql, input.userId, input.vacancyId);
}

/** Patches one owned favorite and returns it. */
export async function updateFavorite(sql: Sql, userId: string, id: string, patch: FavoritePatch): Promise<FavoriteDto | null> {
  const sets: string[] = [];
  const values: unknown[] = [id, userId];
  push(sets, values, patch.collectionId, 'collection_id');
  push(sets, values, patch.note, 'note');
  if (sets.length > 0) {
    await rowsOf(sql, `UPDATE favorites SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2`, values);
  }
  const rows = await rowsOf(sql, `SELECT ${FAVORITE_COLUMNS} ${FAVORITE_FROM} WHERE f.id = $1 AND f.user_id = $2`, [id, userId]);
  return rows[0] === undefined ? null : toFavorite(rows[0]);
}

/** Deletes one owned favorite. */
export async function deleteFavorite(sql: Sql, userId: string, id: string): Promise<boolean> {
  const rows = await rowsOf(sql, `DELETE FROM favorites WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  return rows.length > 0;
}

/** Collections for one account. */
export async function listCollections(sql: Sql, userId: string): Promise<CollectionDto[]> {
  const rows = await rowsOf(sql, `SELECT ${COLLECTION_COLUMNS} FROM collections WHERE user_id = $1 ORDER BY created_at, id`, [userId]);
  return rows.map(toCollection);
}

/** One owned collection. */
export async function findCollection(sql: Sql, userId: string, id: string): Promise<CollectionDto | null> {
  const rows = await rowsOf(sql, `SELECT ${COLLECTION_COLUMNS} FROM collections WHERE user_id = $1 AND id = $2`, [userId, id]);
  return rows[0] === undefined ? null : toCollection(rows[0]);
}

/** The account's default collection, if one exists. */
export async function findDefaultCollection(sql: Sql, userId: string): Promise<CollectionDto | null> {
  const rows = await rowsOf(sql, `SELECT ${COLLECTION_COLUMNS} FROM collections WHERE user_id = $1 AND is_default = true ORDER BY created_at LIMIT 1`, [userId]);
  return rows[0] === undefined ? null : toCollection(rows[0]);
}

/** Inserts a collection. */
export async function insertCollection(sql: Sql, input: NewCollection): Promise<CollectionDto> {
  const rows = await rowsOf(
    sql,
    `INSERT INTO collections (user_id, name, description, is_default) VALUES ($1, $2, $3, $4) RETURNING ${COLLECTION_COLUMNS}`,
    [input.userId, input.name, input.description, input.isDefault],
  );
  return toCollection(rows[0]);
}

/** Patches one owned collection. */
export async function updateCollection(sql: Sql, userId: string, id: string, patch: CollectionPatch): Promise<CollectionDto | null> {
  const sets: string[] = [];
  const values: unknown[] = [id, userId];
  push(sets, values, patch.name, 'name');
  push(sets, values, patch.description, 'description');
  if (sets.length === 0) return findCollection(sql, userId, id);
  const rows = await rowsOf(
    sql,
    `UPDATE collections SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING ${COLLECTION_COLUMNS}`,
    values,
  );
  return rows[0] === undefined ? null : toCollection(rows[0]);
}

/** Deletes a collection. The foreign key clears `favorites.collection_id`. */
export async function deleteCollection(sql: Sql, userId: string, id: string): Promise<boolean> {
  const rows = await rowsOf(sql, `DELETE FROM collections WHERE id = $1 AND user_id = $2 RETURNING id`, [id, userId]);
  return rows.length > 0;
}

/** Card fields for one vacancy, or null when it is gone. */
export async function loadVacancySummary(sql: Sql, vacancyId: string): Promise<VacancyCardSummary | null> {
  const rows = await rowsOf(
    sql,
    `SELECT v.id::text AS id, v.title, v.company_name AS "companyName", v.status::text AS status, v.url,
      v.salary_min AS "salaryMin", v.salary_max AS "salaryMax", v.salary_currency AS "salaryCurrency",
      v.work_format::text AS "workFormat", v.is_foreign_remote AS "isForeignRemote",
      l.city AS "locationCity", l.region AS "locationRegion"
     FROM vacancies v LEFT JOIN locations l ON l.id = v.location_id WHERE v.id = $1`,
    [vacancyId],
  );
  return rows[0] === undefined ? null : toSummary(rows[0]);
}

const COLLECTION_COLUMNS = `id::text AS id, name, description, is_default AS "isDefault"`;

function toFavorite(row: Record<string, unknown> | undefined): FavoriteDto {
  if (row === undefined) throw new Error('Favorite row is missing');
  return {
    id: String(row.id),
    vacancyId: String(row.vacancyId),
    collectionId: textOrNull(row.collectionId),
    note: textOrNull(row.note),
    addedBy: String(row.addedBy) as AuthorKind,
    createdAt: new Date(String(row.createdAt)).toISOString(),
    vacancy: vacancyFromRow(row),
  };
}

function vacancyFromRow(row: Record<string, unknown>): VacancyCardSummary {
  if (row.vacancyMissing === true) return removedVacancySummary(String(row.vacancyId));
  return toSummary(row);
}

function toSummary(row: Record<string, unknown>): VacancyCardSummary {
  return {
    id: String(row.vacancyId ?? row.id),
    title: String(row.title ?? ''),
    companyName: typeof row.companyName === 'string' ? row.companyName : '',
    locationLabel: formatLocationLabel(textOrNull(row.locationCity), textOrNull(row.locationRegion)),
    status: String(row.status) as VacancyStatus,
    url: String(row.url ?? ''),
    salaryMin: asNumber(row.salaryMin),
    salaryMax: asNumber(row.salaryMax),
    salaryCurrency: textOrNull(row.salaryCurrency),
    workFormat: textOrNull(row.workFormat) as WorkFormat | null,
    isForeignRemote: row.isForeignRemote === true,
  };
}

function toCollection(row: Record<string, unknown> | undefined): CollectionDto {
  if (row === undefined) throw new Error('Collection row is missing');
  return {
    id: String(row.id),
    name: String(row.name),
    description: textOrNull(row.description),
    isDefault: row.isDefault === true,
  };
}

function push(sets: string[], values: unknown[], value: unknown, column: string): void {
  if (value === undefined) return;
  values.push(value);
  sets.push(`${column} = $${values.length}`);
}

function textOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function rowsOf(sql: Sql, statement: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const rows = await sql.query(statement, params);
  if (isUpdateTuple(rows)) return rows[0];
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

function isUpdateTuple(value: unknown): value is [Record<string, unknown>[], number | null] {
  return Array.isArray(value) && value.length === 2 && Array.isArray(value[0]);
}
