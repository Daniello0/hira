import type { DocumentKind } from '@hira/contracts';
import { DRAFT_TARGET_MIN_TITLE } from '../memory/memory.constants';

/** A library file a draft request extends, with the text the model should rewrite. */
export interface DraftTarget {
  id: string;
  title: string;
  kind: DocumentKind;
  content: string;
}

/**
 * Picks the file whose title appears in the message, ignoring case.
 * The longest matching title wins so "Cover letter Acme" beats "Cover letter".
 */
export function pickDraftTarget<T extends { id: string; title: string }>(documents: readonly T[], text: string): T | null {
  const haystack = text.toLowerCase();
  let best: T | null = null;
  for (const document of documents) {
    const title = document.title.trim().toLowerCase();
    if (title.length < DRAFT_TARGET_MIN_TITLE || !haystack.includes(title)) continue;
    if (best === null || title.length > best.title.trim().length) best = document;
  }
  return best;
}
