/** Facts below this confidence are not stored. */
export const MEMORY_CONFIDENCE_MIN = 0.7;

/** A new fact this close to a live one is treated as the same fact. */
export const MEMORY_DUPLICATE_COSINE = 0.9;

/** How many non-constraint, unpinned facts join a prompt. */
export const MEMORY_NEIGHBOR_LIMIT = 5;

/** Default lifetime of a GOAL fact. */
export const GOAL_TTL_DAYS = 90;

/** Rebuild the chat summary on this many stored messages, once the window is full. */
export const SUMMARY_EVERY_MESSAGES = 8;

/** At most this many displaced messages go to the first summary of a chat. */
export const SUMMARY_SOURCE_LIMIT = 30;

/** Displaced messages sent to a summary rebuild: one interval plus a small overlap. */
export const SUMMARY_DELTA_MESSAGES = SUMMARY_EVERY_MESSAGES + 2;

/** Nearest unpinned files added beside the pinned ones. */
export const DOCUMENT_NEIGHBOR_LIMIT = 3;

/** Character budget for every document excerpt in one turn. */
export const DOCUMENT_CONTEXT_CHARS = 12_000;

/** Largest accepted resume upload. */
export const PDF_MAX_BYTES = 10 * 1024 * 1024;

/** Largest Markdown or text body. */
export const TEXT_MAX_CHARS = 100_000;

/** `user_documents.title` is varchar(256). */
export const DOCUMENT_TITLE_MAX_CHARS = 256;

export const DOCUMENT_TITLE_TOO_LONG_MESSAGE = 'The document title is too long';

/** Same trigram cutoff retrieval uses for skill surfaces. */
export const TRIGRAM_MATCH_THRESHOLD = 0.8;

export const ACCOUNT_REQUIRED = 'ACCOUNT_REQUIRED';
export const ACCOUNT_REQUIRED_MESSAGE = 'This action needs a registered account';

export const DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND';
export const DOCUMENT_NOT_FOUND_MESSAGE = 'Document was not found';
export const RESUME_FILE_MESSAGE = 'An uploaded file must be a resume PDF';

export const CALL_NOT_FOUND = 'CALL_NOT_FOUND';
export const CALL_NOT_FOUND_MESSAGE = 'Call was not found';
export const CALL_ENDED = 'CALL_ENDED';
export const CALL_ENDED_MESSAGE = 'Call has already ended';

export const MEMORY_NOT_FOUND = 'MEMORY_NOT_FOUND';
export const MEMORY_NOT_FOUND_MESSAGE = 'Memory fact was not found';
export const MEMORY_PATCH_EMPTY_MESSAGE = 'Send content or isPinned';

/** Longest memory fact a person can type. */
export const MEMORY_CONTENT_MAX = 4_000;

export const SKILL_EXISTS = 'SKILL_EXISTS';
export const SKILL_EXISTS_MESSAGE = 'That skill is already on the profile';
export const SKILL_NOT_FOUND = 'SKILL_NOT_FOUND';
export const SKILL_NOT_FOUND_MESSAGE = 'Skill was not found';

export const SUGGESTION_NOT_FOUND = 'SUGGESTION_NOT_FOUND';
export const SUGGESTION_NOT_FOUND_MESSAGE = 'Suggestion was not found';
export const SUGGESTION_CLOSED_MESSAGE = 'Suggestion is no longer pending';

export const PDF_TEXT_EMPTY_MESSAGE = 'The PDF did not contain text';
export const PDF_TOO_LARGE_MESSAGE = 'The PDF is too large';
export const PDF_CONTENT_LOCKED_MESSAGE = 'PDF text cannot be edited';
export const RESUME_TEXT_MESSAGE = 'A resume must be uploaded as a PDF file';

/** A library title shorter than this is too generic to match inside a message. */
export const DRAFT_TARGET_MIN_TITLE = 3;
export const TEXT_TOO_LONG_MESSAGE = 'The document text is too long';
