import { Inject, Injectable } from '@nestjs/common';
import { AuthorKind, type CollectionDto, type CreateCollectionRequest, type CreateFavoriteRequest, type FavoriteDto, type UpdateCollectionRequest, type UpdateFavoriteRequest } from '@hira/contracts';
import { DEFAULT_COLLECTION_NAME } from './favorite.constants';
import { CollectionMissingError, CollectionNameError, DefaultCollectionProtectedError, FavoriteMissingError, VacancyMissingError } from './favorite.errors';
import { isUniqueViolation } from './is-unique-violation';
import { FAVORITE_STORE, type FavoriteListQuery, type FavoriteStore } from './favorite.store';

/** Account favorites. A second save of the same vacancy returns the existing row. */
@Injectable()
export class FavoriteService {
  constructor(@Inject(FAVORITE_STORE) private readonly store: FavoriteStore) {}

  /** Saved vacancies, optionally inside one collection or matching a note. */
  async list(userId: string, query: FavoriteListQuery): Promise<FavoriteDto[]> {
    await this.requireCollection(userId, query.collectionId);
    return this.store.list(userId, query);
  }

  /** Saves a vacancy. The first save lands in the default collection. */
  async save(userId: string, body: CreateFavoriteRequest): Promise<FavoriteDto> {
    if ((await this.store.vacancySummary(body.vacancyId)) === null) throw new VacancyMissingError();
    const existing = await this.store.findByVacancy(userId, body.vacancyId);
    if (existing !== null) return existing;
    return this.insert(userId, body);
  }

  /** Moves a favorite or rewrites its note. */
  async update(userId: string, id: string, patch: UpdateFavoriteRequest): Promise<FavoriteDto> {
    await this.requireCollection(userId, patch.collectionId ?? undefined);
    const updated = await this.store.update(userId, id, {
      ...(patch.collectionId === undefined ? {} : { collectionId: patch.collectionId }),
      ...(patch.note === undefined ? {} : { note: emptyToNull(patch.note) }),
    });
    if (updated === null) throw new FavoriteMissingError();
    return updated;
  }

  /** Removes one saved vacancy. */
  async remove(userId: string, id: string): Promise<void> {
    if (!(await this.store.delete(userId, id))) throw new FavoriteMissingError();
  }

  /** Collections owned by the account. */
  listCollections(userId: string): Promise<CollectionDto[]> {
    return this.store.listCollections(userId);
  }

  /** Creates a non-default collection. */
  createCollection(userId: string, body: CreateCollectionRequest): Promise<CollectionDto> {
    return this.store.insertCollection({
      userId,
      name: collectionName(body.name),
      description: emptyToNull(body.description),
      isDefault: false,
    });
  }

  /** Renames a collection or changes its description. */
  async updateCollection(userId: string, id: string, patch: UpdateCollectionRequest): Promise<CollectionDto> {
    const updated = await this.store.updateCollection(userId, id, {
      ...(patch.name === undefined ? {} : { name: collectionName(patch.name) }),
      ...(patch.description === undefined ? {} : { description: emptyToNull(patch.description) }),
    });
    if (updated === null) throw new CollectionMissingError();
    return updated;
  }

  /** Deletes a collection. Saved vacancies stay, without that collection. */
  async deleteCollection(userId: string, id: string): Promise<void> {
    const collection = await this.store.findCollection(userId, id);
    if (collection === null) throw new CollectionMissingError();
    if (collection.isDefault) throw new DefaultCollectionProtectedError();
    if (!(await this.store.deleteCollection(userId, id))) throw new CollectionMissingError();
  }

  private async insert(userId: string, body: CreateFavoriteRequest): Promise<FavoriteDto> {
    const saved = await this.store.insert({
      userId,
      vacancyId: body.vacancyId,
      collectionId: await this.collectionFor(userId, body.collectionId ?? null),
      note: emptyToNull(body.note),
      addedBy: AuthorKind.User,
    });
    if (saved === null) throw new FavoriteMissingError();
    return saved;
  }

  private async collectionFor(userId: string, collectionId: string | null): Promise<string> {
    if (collectionId !== null) return (await this.ownedCollection(userId, collectionId)).id;
    return this.ensureDefaultCollection(userId);
  }

  private async ensureDefaultCollection(userId: string): Promise<string> {
    const current = await this.store.findDefaultCollection(userId);
    if (current !== null) return current.id;
    try {
      const created = await this.store.insertCollection({
        userId,
        name: DEFAULT_COLLECTION_NAME,
        description: null,
        isDefault: true,
      });
      return created.id;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const again = await this.store.findDefaultCollection(userId);
      if (again === null) throw error;
      return again.id;
    }
  }

  private async requireCollection(userId: string, collectionId: string | undefined): Promise<void> {
    if (collectionId === undefined) return;
    await this.ownedCollection(userId, collectionId);
  }

  private async ownedCollection(userId: string, collectionId: string) {
    const collection = await this.store.findCollection(userId, collectionId);
    if (collection === null) throw new CollectionMissingError();
    return collection;
  }
}

function collectionName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new CollectionNameError();
  return trimmed;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
