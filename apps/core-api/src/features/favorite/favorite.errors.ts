import {
  COLLECTION_NAME_MESSAGE,
  COLLECTION_NOT_FOUND_MESSAGE,
  FAVORITE_NOT_FOUND_MESSAGE,
  VACANCY_NOT_FOUND_MESSAGE,
} from './favorite.constants';

/** The favorite id is missing or belongs to another account. */
export class FavoriteMissingError extends Error {
  constructor() {
    super(FAVORITE_NOT_FOUND_MESSAGE);
    this.name = 'FavoriteMissingError';
  }
}

/** The collection id is missing or belongs to another account. */
export class CollectionMissingError extends Error {
  constructor() {
    super(COLLECTION_NOT_FOUND_MESSAGE);
    this.name = 'CollectionMissingError';
  }
}

/** The vacancy is not in the corpus. */
export class VacancyMissingError extends Error {
  constructor() {
    super(VACANCY_NOT_FOUND_MESSAGE);
    this.name = 'VacancyMissingError';
  }
}

/** A favorite or collection field failed a check the body pipe does not cover. */
export class FavoriteInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FavoriteInputError';
  }
}

/** Blank collection names are rejected after trim. */
export class CollectionNameError extends FavoriteInputError {
  constructor() {
    super(COLLECTION_NAME_MESSAGE);
    this.name = 'CollectionNameError';
  }
}
