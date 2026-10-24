/** Fallback title length when no document word is found in the request. */
export const DRAFT_TITLE_MAX_WORDS = 6;
export const DRAFT_TITLE_MAX_CHARS = 60;

/**
 * Document words checked in order; the first hit names the draft.
 * More specific phrases come before the general ones. The last rule is the generic fallback.
 */
export const DRAFT_TITLE_RULES: ReadonlyArray<{ title: string; stems: readonly string[] }> = [
  { title: 'Cover letter', stems: ['cover letter', 'сопроводительн', 'суправаджальн'] },
  { title: 'Preferences', stems: ['preference', 'предпочтен', 'перавагі'] },
  { title: 'Interview script', stems: ['interview script', 'сценари', 'script'] },
  { title: 'Letter', stems: ['letter', 'письм', 'ліст'] },
  { title: 'Notes', stems: ['note', 'заметк', 'нататк'] },
];
