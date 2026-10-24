import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { CollectionDto, FavoriteDto, VacancyCardSummary } from '@hira/contracts';
import type {
  CollectionPatch,
  FavoriteListQuery,
  FavoritePatch,
  FavoriteStore,
  NewCollection,
  NewFavorite,
} from './favorite.store';

interface FavoriteRow {
  id: string;
  userId: string;
  vacancyId: string;
  collectionId: string | null;
  note: string | null;
  addedBy: NewFavorite['addedBy'];
  createdAt: Date;
}

interface CollectionRow {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

/** Process-local favorites. Tests seed `vacancies` because there is no corpus. */
@Injectable()
export class MemoryFavoriteStore implements FavoriteStore {
  readonly vacancies = new Map<string, VacancyCardSummary>();
  private readonly favorites: FavoriteRow[] = [];
  private readonly collections: CollectionRow[] = [];

  /** @inheritdoc */
  async list(userId: string, query: FavoriteListQuery): Promise<FavoriteDto[]> {
    return this.favorites
      .filter((row) => row.userId === userId && matches(row, query))
      .map((row) => this.toDto(row))
      .filter((row): row is FavoriteDto => row !== null);
  }

  /** @inheritdoc */
  async findByVacancy(userId: string, vacancyId: string): Promise<FavoriteDto | null> {
    const row = this.favorites.find((item) => item.userId === userId && item.vacancyId === vacancyId);
    return row === undefined ? null : this.toDto(row);
  }

  /** @inheritdoc */
  async insert(input: NewFavorite): Promise<FavoriteDto | null> {
    const existing = await this.findByVacancy(input.userId, input.vacancyId);
    if (existing !== null) return existing;
    const row: FavoriteRow = { ...input, id: randomUUID(), createdAt: new Date() };
    this.favorites.push(row);
    return this.toDto(row);
  }

  /** @inheritdoc */
  async update(userId: string, id: string, patch: FavoritePatch): Promise<FavoriteDto | null> {
    const row = this.owned(userId, id);
    if (row === null) return null;
    if (patch.collectionId !== undefined) row.collectionId = patch.collectionId;
    if (patch.note !== undefined) row.note = patch.note;
    return this.toDto(row);
  }

  /** @inheritdoc */
  async delete(userId: string, id: string): Promise<boolean> {
    const index = this.favorites.findIndex((row) => row.userId === userId && row.id === id);
    if (index < 0) return false;
    this.favorites.splice(index, 1);
    return true;
  }

  /** @inheritdoc */
  async listCollections(userId: string): Promise<CollectionDto[]> {
    return this.collections.filter((row) => row.userId === userId).map(toCollection);
  }

  /** @inheritdoc */
  async findCollection(userId: string, id: string): Promise<CollectionDto | null> {
    const row = this.collections.find((item) => item.userId === userId && item.id === id);
    return row === undefined ? null : toCollection(row);
  }

  /** @inheritdoc */
  async findDefaultCollection(userId: string): Promise<CollectionDto | null> {
    const row = this.collections.find((item) => item.userId === userId && item.isDefault);
    return row === undefined ? null : toCollection(row);
  }

  /** @inheritdoc */
  async insertCollection(input: NewCollection): Promise<CollectionDto> {
    const row: CollectionRow = { ...input, id: randomUUID() };
    this.collections.push(row);
    return toCollection(row);
  }

  /** @inheritdoc */
  async updateCollection(userId: string, id: string, patch: CollectionPatch): Promise<CollectionDto | null> {
    const row = this.collections.find((item) => item.userId === userId && item.id === id);
    if (row === undefined) return null;
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.description !== undefined) row.description = patch.description;
    return toCollection(row);
  }

  /** @inheritdoc */
  async deleteCollection(userId: string, id: string): Promise<boolean> {
    const index = this.collections.findIndex((row) => row.userId === userId && row.id === id);
    if (index < 0) return false;
    this.collections.splice(index, 1);
    this.clearCollection(userId, id);
    return true;
  }

  /** @inheritdoc */
  async vacancySummary(vacancyId: string): Promise<VacancyCardSummary | null> {
    return this.vacancies.get(vacancyId) ?? null;
  }

  private owned(userId: string, id: string): FavoriteRow | null {
    return this.favorites.find((row) => row.userId === userId && row.id === id) ?? null;
  }

  private clearCollection(userId: string, collectionId: string): void {
    for (const row of this.favorites) {
      if (row.userId === userId && row.collectionId === collectionId) row.collectionId = null;
    }
  }

  private toDto(row: FavoriteRow): FavoriteDto | null {
    const vacancy = this.vacancies.get(row.vacancyId);
    if (vacancy === undefined) return null;
    return {
      id: row.id,
      vacancyId: row.vacancyId,
      collectionId: row.collectionId,
      note: row.note,
      addedBy: row.addedBy,
      createdAt: row.createdAt.toISOString(),
      vacancy,
    };
  }
}

function matches(row: FavoriteRow, query: FavoriteListQuery): boolean {
  if (query.collectionId !== undefined && row.collectionId !== query.collectionId) return false;
  return noteMatches(row.note, query.noteQuery);
}

function noteMatches(note: string | null, query: string | undefined): boolean {
  if (query === undefined) return true;
  if (note === null) return false;
  return note.toLowerCase().includes(query.toLowerCase());
}

function toCollection(row: CollectionRow): CollectionDto {
  return { id: row.id, name: row.name, description: row.description, isDefault: row.isDefault };
}
