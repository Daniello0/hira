import type { DocumentDraftDto, DocumentFormat, DocumentKind } from '@hira/contracts';
import { createTextDocument, patchDocument } from '../library/library-api';

/** What the user changed on the draft card before saving. */
export interface DraftEdits {
  title: string;
  format: DocumentFormat;
  kind: DocumentKind;
}

const NO_TITLE = 'Give the file a title';
const COULD_NOT_REACH = 'Could not reach Hira';

/** Writes the draft as a new library file marked as written by Hira. `null` on success. */
export async function saveDraftAsNew(draft: DocumentDraftDto, edits: DraftEdits): Promise<string | null> {
  const title = edits.title.trim();
  if (title.length === 0) return NO_TITLE;
  try {
    return await createTextDocument({ kind: edits.kind, title, format: edits.format, content: draft.content, fromAssistant: true });
  } catch {
    return COULD_NOT_REACH;
  }
}

/** Title and text written over the named file. A string is the reason it cannot be saved. */
export function replacementPatch(
  draft: DocumentDraftDto,
  title: string,
): { title: string; content: string } | string {
  if (draft.targetDocumentId === null) return 'There is no file to replace';
  const nextTitle = title.trim();
  if (nextTitle.length === 0) return NO_TITLE;
  return { title: nextTitle, content: draft.content };
}

/** Replaces the named file with the draft, including a title the user edited. `null` on success. */
export async function replaceWithDraft(draft: DocumentDraftDto, title: string): Promise<string | null> {
  const patch = replacementPatch(draft, title);
  if (typeof patch === 'string') return patch;
  if (draft.targetDocumentId === null) return 'There is no file to replace';
  try {
    return await patchDocument(draft.targetDocumentId, patch);
  } catch {
    return COULD_NOT_REACH;
  }
}
