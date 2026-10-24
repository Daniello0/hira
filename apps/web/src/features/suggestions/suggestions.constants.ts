/** Server extraction runs after the turn; these delays pick its result up without a reload. */
export const SUGGESTION_REFRESH_DELAYS_MS: readonly number[] = [3_000, 10_000];
export const SUGGESTION_UPDATE_FAILED = 'Could not update the suggestion';
export const SKILL_NOT_IN_CATALOG = 'This skill is not in the catalog yet.';
