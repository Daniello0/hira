import type { CollectionDto, FavoriteDto } from '@hira/contracts';

export interface FavoriteGroup {
  id: string | null;
  name: string;
  isDefault: boolean;
  items: FavoriteDto[];
}

/** Groups saved vacancies by collection. Detached rows sit in Uncategorized. */
export function groupFavorites(favorites: readonly FavoriteDto[], collections: readonly CollectionDto[]): FavoriteGroup[] {
  const names = new Map(collections.map((collection) => [collection.id, collection.name]));
  const buckets = new Map<string | null, FavoriteDto[]>(collections.map((collection) => [collection.id, []]));
  buckets.set(null, []);
  for (const favorite of favorites) place(buckets, names, favorite);
  const groups: FavoriteGroup[] = collections
    .map((collection) => ({
      id: collection.id,
      name: collection.name,
      isDefault: collection.isDefault,
      items: buckets.get(collection.id) ?? [],
    }))
    .filter((group) => group.items.length > 0);
  const loose = buckets.get(null) ?? [];
  if (loose.length > 0) {
    groups.push({ id: null, name: 'Uncategorized', isDefault: false, items: loose });
  }
  return groups;
}

function place(buckets: Map<string | null, FavoriteDto[]>, names: Map<string, string>, favorite: FavoriteDto): void {
  const key = favorite.collectionId !== null && names.has(favorite.collectionId) ? favorite.collectionId : null;
  buckets.get(key)?.push(favorite);
}
