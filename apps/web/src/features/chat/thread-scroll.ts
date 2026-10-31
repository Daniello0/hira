/** How close to the end still counts as reading the newest text. */
export const NEAR_BOTTOM_PX = 96;

interface ScrollMetrics {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
}

/** A person reading older messages must not be pulled down by streaming text. */
export function isNearBottom({ scrollTop, scrollHeight, clientHeight }: ScrollMetrics): boolean {
  return scrollHeight - scrollTop - clientHeight <= NEAR_BOTTOM_PX;
}

/** Adds dictated words to the draft with exactly one space between them. */
export function appendDictation(draft: string, text: string): string {
  const words = text.trim();
  if (words.length === 0) return draft;
  if (draft.length === 0) return words;
  return /\s$/.test(draft) ? `${draft}${words}` : `${draft} ${words}`;
}
