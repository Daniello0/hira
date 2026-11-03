import { ParseStatus, type CreateTextDocumentRequest, type DocumentDetailDto, type DocumentSummaryDto, type UpdateDocumentRequest } from '@hira/contracts';
import { authedFetch, readJson } from '../../common/api/authed-fetch';
import { invalidate } from '../../common/data/data-version.store';
import { jsonRequest } from '../../common/api/core-api';
import { readApiMessage } from '../auth/read-api-message';

/** Library rows without the extracted body. */
export async function fetchDocuments(): Promise<DocumentSummaryDto[] | null> {
  return readJson<DocumentSummaryDto[]>(await authedFetch('/api/v1/documents'));
}

/** One file, including the text Hira can read. */
export async function fetchDocument(id: string): Promise<DocumentDetailDto | null> {
  return readJson<DocumentDetailDto>(await authedFetch(`/api/v1/documents/${id}`));
}

/** Creates a Markdown or text file. Resumes are uploaded separately. */
export async function createTextDocument(body: CreateTextDocumentRequest): Promise<string | null> {
  const response = await authedFetch('/api/v1/documents', jsonRequest('POST', body));
  if (response.ok) invalidate('library');
  if (response.ok) return null;
  return readApiMessage(response, 'Could not create the file');
}

/** What came of a resume upload. A saved file may still have failed to parse. */
export type ResumeUpload = { kind: 'failed'; message: string } | { kind: 'saved'; parsed: boolean };

/** Uploads a resume PDF. Parsing may add profile suggestions. */
export async function uploadResume(file: File): Promise<ResumeUpload> {
  const body = new FormData();
  body.append('file', file);
  const response = await authedFetch('/api/v1/documents', { method: 'POST', body });
  if (!response.ok) return { kind: 'failed', message: await readApiMessage(response, 'Could not upload the resume') };
  invalidate('library');
  const saved = (await response.json().catch(() => null)) as { parseStatus?: ParseStatus | null } | null;
  return { kind: 'saved', parsed: saved?.parseStatus !== ParseStatus.Failed };
}

/** Edits title, text, or the pin. PDF text is rejected by the API. */
export async function patchDocument(id: string, body: UpdateDocumentRequest): Promise<string | null> {
  const response = await authedFetch(`/api/v1/documents/${id}`, jsonRequest('PATCH', body));
  if (response.ok) invalidate('library');
  if (response.ok) return null;
  return readApiMessage(response, 'Could not update the file');
}

/** Deletes a library file. */
export async function deleteDocument(id: string): Promise<boolean> {
  const response = await authedFetch(`/api/v1/documents/${id}`, { method: 'DELETE' });
  if (response.ok) invalidate('library');
  return response.ok;
}
