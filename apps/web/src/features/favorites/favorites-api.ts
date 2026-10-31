import type { CollectionDto, CreateFavoriteRequest, FavoriteDto, UpdateCollectionRequest, UpdateFavoriteRequest } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';
import { jsonRequest } from '../../common/api/core-api';
import { invalidate } from '../../common/data/data-version.store';
import { readApiMessage } from '../auth/read-api-message';
import { COLLECTION_DELETE_ERROR_MESSAGE } from './favorites.constants';

/** Saved vacancies. `q` filters the note. */
export async function fetchFavorites(noteQuery?: string): Promise<FavoriteDto[] | null> {
  const query = noteQuery === undefined || noteQuery.trim().length === 0 ? '' : `?q=${encodeURIComponent(noteQuery.trim())}`;
  return readJson<FavoriteDto[]>(await authedFetch(`/api/v1/favorites${query}`));
}

/** Saves a vacancy. A second save returns the same row. */
export async function createFavorite(body: CreateFavoriteRequest): Promise<FavoriteDto | null> {
  const saved = await readJson<FavoriteDto>(await authedFetch('/api/v1/favorites', jsonRequest('POST', body)));
  if (saved !== null) invalidate('favorites');
  return saved;
}

/** Moves a favorite or rewrites its note. */
export async function patchFavorite(id: string, body: UpdateFavoriteRequest): Promise<string | null> {
  const response = await authedFetch(`/api/v1/favorites/${id}`, jsonRequest('PATCH', body));
  if (response.ok) return null;
  return readApiMessage(response, 'Could not update the favorite');
}

/** Removes a saved vacancy. */
export async function deleteFavorite(id: string): Promise<boolean> {
  const response = await authedFetch(`/api/v1/favorites/${id}`, { method: 'DELETE' });
  if (response.ok) invalidate('favorites');
  return response.ok;
}

/** Collections, including the default Saved list. */
export async function fetchCollections(): Promise<CollectionDto[] | null> {
  return readJson<CollectionDto[]>(await authedFetch('/api/v1/collections'));
}

/** Creates a named collection. */
export async function createCollection(name: string): Promise<string | null> {
  const response = await authedFetch('/api/v1/collections', jsonRequest('POST', { name }));
  if (response.ok) return null;
  return readApiMessage(response, 'Could not create the collection');
}

/** Renames a collection. */
export async function patchCollection(id: string, body: UpdateCollectionRequest): Promise<string | null> {
  const response = await authedFetch(`/api/v1/collections/${id}`, jsonRequest('PATCH', body));
  if (response.ok) return null;
  return readApiMessage(response, 'Could not rename the collection');
}

/** Deletes a collection. Favorites stay, without that group. */
export async function deleteCollection(id: string): Promise<string | null> {
  const response = await authedFetch(`/api/v1/collections/${id}`, { method: 'DELETE' });
  if (response.ok) return null;
  return readApiMessage(response, COLLECTION_DELETE_ERROR_MESSAGE);
}
