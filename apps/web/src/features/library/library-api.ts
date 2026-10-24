import type { CreateTextDocumentRequest, DocumentDetailDto, DocumentSummaryDto, UpdateDocumentRequest } from '@hira/contracts';
import { coreFetch, jsonRequest } from '../../common/api/core-api';
import { readApiMessage } from '../auth/read-api-message';

/** Library rows without the extracted body. */
export async function fetchDocuments(token: string): Promise<DocumentSummaryDto[] | null> {
  const response = await coreFetch('/api/v1/documents', { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as DocumentSummaryDto[];
}

/** One file, including the text Hira can read. */
export async function fetchDocument(token: string, id: string): Promise<DocumentDetailDto | null> {
  const response = await coreFetch(`/api/v1/documents/${id}`, { method: 'GET' }, token);
  if (!response.ok) return null;
  return (await response.json()) as DocumentDetailDto;
}

/** Creates a Markdown or text file. Resumes are uploaded separately. */
export async function createTextDocument(token: string, body: CreateTextDocumentRequest): Promise<string | null> {
  const response = await coreFetch('/api/v1/documents', jsonRequest('POST', body), token);
  if (response.ok) return null;
  return readApiMessage(response, 'Could not create the file');
}

/** Uploads a resume PDF. Parsing may add profile suggestions. */
export async function uploadResume(token: string, file: File): Promise<string | null> {
  const body = new FormData();
  body.append('file', file);
  const response = await coreFetch('/api/v1/documents', { method: 'POST', body }, token);
  if (response.ok) return null;
  return readApiMessage(response, 'Could not upload the resume');
}

/** Edits title, text, or the pin. PDF text is rejected by the API. */
export async function patchDocument(token: string, id: string, body: UpdateDocumentRequest): Promise<string | null> {
  const response = await coreFetch(`/api/v1/documents/${id}`, jsonRequest('PATCH', body), token);
  if (response.ok) return null;
  return readApiMessage(response, 'Could not update the file');
}

/** Deletes a library file. */
export async function deleteDocument(token: string, id: string): Promise<boolean> {
  const response = await coreFetch(`/api/v1/documents/${id}`, { method: 'DELETE' }, token);
  return response.ok;
}
