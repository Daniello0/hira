import type { FavoriteListQuery } from './favorite.store';
import { COLLECTION_ID_MESSAGE, isUuid } from './favorite.constants';
import { FavoriteInputError } from './favorite.errors';

/** Reads list filters. A non-uuid collection id is a validation error. */
export function readFavoriteQuery(collectionId?: string, note?: string): FavoriteListQuery {
  const id = blank(collectionId);
  if (id !== undefined && !isUuid(id)) throw new FavoriteInputError(COLLECTION_ID_MESSAGE);
  return { collectionId: id, noteQuery: blank(note) };
}

function blank(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
