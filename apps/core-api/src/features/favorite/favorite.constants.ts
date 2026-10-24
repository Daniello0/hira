/** Collection created the first time an account saves a vacancy. */
export const DEFAULT_COLLECTION_NAME = 'Saved';

/** `collections.name` is varchar(128). */
export const COLLECTION_NAME_MAX = 128;

/** Cap for a private note on a saved vacancy. */
export const FAVORITE_NOTE_MAX = 2_000;

export const FAVORITE_NOT_FOUND = 'FAVORITE_NOT_FOUND';
export const FAVORITE_NOT_FOUND_MESSAGE = 'Favorite was not found';

export const COLLECTION_NOT_FOUND = 'COLLECTION_NOT_FOUND';
export const COLLECTION_NOT_FOUND_MESSAGE = 'Collection was not found';

export const VACANCY_NOT_FOUND = 'VACANCY_NOT_FOUND';
export const VACANCY_NOT_FOUND_MESSAGE = 'Vacancy was not found';

export const COLLECTION_ID_MESSAGE = 'collectionId must be a uuid';
export const COLLECTION_NAME_MESSAGE = 'Collection name is required';

export const DEFAULT_COLLECTION_PROTECTED = 'DEFAULT_COLLECTION_PROTECTED';
export const DEFAULT_COLLECTION_PROTECTED_MESSAGE = 'The default collection cannot be deleted';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the string is a UUID. Query strings are not parsed by the body pipe. */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
