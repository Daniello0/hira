import type { DocumentKind, PromptDocument } from '@hira/contracts';
import { DOCUMENT_CONTEXT_CHARS } from '../memory/memory.constants';

/** A library file reduced to what prompt selection needs. */
export interface PromptSourceDocument {
  title: string;
  kind: DocumentKind;
  content: string;
  isPinned: boolean;
}

/**
 * Pinned files first, then the unpinned ones in the order the store ranked them,
 * trimmed to the character budget.
 */
export function selectPromptDocuments(documents: readonly PromptSourceDocument[]): PromptDocument[] {
  const pinned = documents.filter((document) => document.isPinned);
  const ranked = documents.filter((document) => !document.isPinned);
  return fitBudget([...pinned, ...ranked]);
}

/** Puts `target` first with its full budget share, dropping any older copy of the same title. */
export function withTargetDocument(documents: readonly PromptDocument[], target: PromptDocument | null): PromptDocument[] {
  if (target === null) return [...documents];
  const rest = documents.filter((document) => document.title !== target.title);
  return fitBudget([{ ...target, isPinned: true }, ...rest.map((document) => ({ ...document, isPinned: false }))]);
}

function fitBudget(documents: readonly PromptSourceDocument[]): PromptDocument[] {
  const fitted: PromptDocument[] = [];
  let remaining = DOCUMENT_CONTEXT_CHARS;
  for (const document of documents) {
    if (remaining <= 0) break;
    const content = document.content.slice(0, remaining);
    remaining -= content.length;
    fitted.push({ title: document.title, kind: document.kind, content });
  }
  return fitted;
}
