/** `user_profiles.headline` is varchar(256). */
export const PROFILE_HEADLINE_MAX = 256;

/** Cap for the free-text `about` and `education` fields. */
export const PROFILE_TEXT_MAX = 4_000;

/** Desired roles a profile may list, and the length of one role. */
export const PROFILE_ROLES_MAX = 20;
export const PROFILE_ROLE_MAX_CHARS = 128;

/** Preferred cities a profile may list. */
export const PROFILE_LOCATIONS_MAX = 50;

/** `salary_expectation_min` is numeric(12, 2). */
export const PROFILE_SALARY_MAX = 9_999_999_999;

/** ISO 4217 code, as stored in `currency char(3)`. */
export const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

/** Plausible years of experience with one skill. */
export const SKILL_YEARS_MAX = 60;
