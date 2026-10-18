import { DocumentKind, type PromptDocument } from '@hira/contracts';
import { cosineSimilarity } from '../memory/cosine';
import { DOCUMENT_CONTEXT_CHARS, DOCUMENT_NEIGHBOR_LIMIT } from '../memory/memory.constants';

/** A library file reduced to what prompt selection needs. */
export interface PromptSourceDocument {
  title: string;
  kind: DocumentKind;
  content: string;
  isPinned: boolean;
  embedding: number[] | null;
}

/** Pinned files first, then a few nearest unpinned files, trimmed to the character budget. */
export function selectPromptDocuments(
  documents: readonly PromptSourceDocument[],
  query: readonly number[] | null,
): PromptDocument[] {
  const pinned = documents.filter((document) => document.isPinned);
  const nearest = nearestDocuments(documents, query);
  return fitBudget([...pinned, ...nearest]);
}

function nearestDocuments(
  documents: readonly PromptSourceDocument[],
  query: readonly number[] | null,
): PromptSourceDocument[] {
  if (query === null) return [];
  return documents
    .filter((document) => !document.isPinned && document.embedding !== null)
    .map((document) => ({ document, score: cosineSimilarity(document.embedding ?? [], query) }))
    .sort((left, right) => right.score - left.score || left.document.title.localeCompare(right.document.title))
    .slice(0, DOCUMENT_NEIGHBOR_LIMIT)
    .map((row) => row.document);
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
