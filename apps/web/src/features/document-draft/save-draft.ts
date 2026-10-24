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

/** Replaces the text of the file the request named. Its title stays. `null` on success. */
export async function replaceWithDraft(draft: DocumentDraftDto): Promise<string | null> {
  if (draft.targetDocumentId === null) return 'There is no file to replace';
  try {
    return await patchDocument(draft.targetDocumentId, { content: draft.content });
  } catch {
    return COULD_NOT_REACH;
  }
}
