import type { AuthorKind, CollectionDto, FavoriteDto, VacancyCardSummary } from '@hira/contracts';

export const FAVORITE_STORE = Symbol('FAVORITE_STORE');

export interface FavoriteListQuery {
  collectionId?: string;
  noteQuery?: string;
}

export interface NewFavorite {
  userId: string;
  vacancyId: string;
  collectionId: string;
  note: string | null;
  addedBy: AuthorKind;
}

export interface FavoritePatch {
  collectionId?: string | null;
  note?: string | null;
}

export interface NewCollection {
  userId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export interface CollectionPatch {
  name?: string;
  description?: string | null;
}

/** Saved vacancies and the collections that group them. */
export interface FavoriteStore {
  list(userId: string, query: FavoriteListQuery): Promise<FavoriteDto[]>;
  findByVacancy(userId: string, vacancyId: string): Promise<FavoriteDto | null>;
  insert(input: NewFavorite): Promise<FavoriteDto | null>;
  update(userId: string, id: string, patch: FavoritePatch): Promise<FavoriteDto | null>;
  delete(userId: string, id: string): Promise<boolean>;
  listCollections(userId: string): Promise<CollectionDto[]>;
  findCollection(userId: string, id: string): Promise<CollectionDto | null>;
  findDefaultCollection(userId: string): Promise<CollectionDto | null>;
  insertCollection(input: NewCollection): Promise<CollectionDto>;
  updateCollection(userId: string, id: string, patch: CollectionPatch): Promise<CollectionDto | null>;
  deleteCollection(userId: string, id: string): Promise<boolean>;
  vacancySummary(vacancyId: string): Promise<VacancyCardSummary | null>;
}
