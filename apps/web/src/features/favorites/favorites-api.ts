import type { CollectionDto, CreateFavoriteRequest, FavoriteDto, UpdateFavoriteRequest } from '@hira/contracts';
import { coreFetch, jsonRequest } from '../../common/api/core-api';
import { readApiMessage } from '../auth/read-api-message';

/** Saved vacancies. `q` filters the note. */
export async function fetchFavorites(token: string, noteQuery?: string): Promise<FavoriteDto[] | null> {
  const query = noteQuery === undefined || noteQuery.trim().length === 0 ? '' : `?q=${encodeURIComponent(noteQuery.trim())}`;
  const response = await coreFetch(`/api/v1/favorites${query}`, { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as FavoriteDto[];
}

/** Saves a vacancy. A second save returns the same row. */
export async function createFavorite(token: string, body: CreateFavoriteRequest): Promise<FavoriteDto | null> {
  const response = await coreFetch('/api/v1/favorites', jsonRequest('POST', body), token);
  if (!response.ok) return null;
  return (await response.json()) as FavoriteDto;
}

/** Moves a favorite or rewrites its note. */
export async function patchFavorite(token: string, id: string, body: UpdateFavoriteRequest): Promise<string | null> {
  const response = await coreFetch(`/api/v1/favorites/${id}`, jsonRequest('PATCH', body), token);
  if (response.ok) return null;
  return readApiMessage(response, 'Could not update the favorite');
}

/** Removes a saved vacancy. */
export async function deleteFavorite(token: string, id: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/favorites/${id}`, { method: 'DELETE' }, token);
  return response.ok;
}

/** Collections, including the default Saved list. */
export async function fetchCollections(token: string): Promise<CollectionDto[] | null> {
  const response = await coreFetch('/api/v1/collections', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as CollectionDto[];
}

/** Creates a named collection. */
export async function createCollection(token: string, name: string): Promise<string | null> {
  const response = await coreFetch('/api/v1/collections', jsonRequest('POST', { name }), token);
  if (response.ok) return null;
  return readApiMessage(response, 'Could not create the collection');
}

/** Deletes a collection. Favorites stay, without that group. */
export async function deleteCollection(token: string, id: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/collections/${id}`, { method: 'DELETE' }, token);
  return response.ok;
}
