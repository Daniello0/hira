export const FAVORITES_EMPTY_MESSAGE = 'No saved vacancies yet.';
export const FAVORITES_SEARCH_EMPTY_MESSAGE = 'No favorites match this note search.';
export const FAVORITES_LOAD_ERROR_MESSAGE = 'Could not load favorites.';
export const COLLECTION_DELETE_ERROR_MESSAGE = 'Could not delete the collection.';

/** Empty-state copy when the grouped list has no rows. */
export function favoritesEmptyMessage(searchQuery: string, favoriteCount: number): string | null {
  if (favoriteCount > 0) return null;
  return searchQuery.trim().length > 0 ? FAVORITES_SEARCH_EMPTY_MESSAGE : FAVORITES_EMPTY_MESSAGE;
}
