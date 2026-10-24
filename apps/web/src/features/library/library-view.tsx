'use client';

import { DocumentFormat, DocumentKind, type DocumentDetailDto, type DocumentSummaryDto } from '@hira/contracts';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { useSession } from '../auth/session.store';
import { useSuggestions } from '../suggestions/suggestion.store';
import { DocumentEditor } from './document-editor';
import { createTextDocument, fetchDocument, fetchDocuments, uploadResume } from './library-api';
import { LIBRARY_SECTIONS, TEXT_KINDS, parseStatusLabel } from './library.constants';

/** Files grouped by kind. A PDF resume can offer skills after upload. */
export function LibraryView() {
  const token = useSession((state) => state.accessToken);
  const [documents, setDocuments] = useState<DocumentSummaryDto[]>([]);
  const [selected, setSelected] = useState<DocumentDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (token === null) return;
    const next = await fetchDocuments(token);
    if (next !== null) setDocuments(next);
  }, [token]);
  useEffect(() => { void reload(); }, [reload]);
  if (token === null) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Library</h1>
      <UploadResume token={token} onDone={reload} onError={setError} />
      <CreateText token={token} onDone={reload} onError={setError} />
      {error !== null ? <p role="alert">{error}</p> : null}
      {LIBRARY_SECTIONS.map((section) => (
        <Section key={section.kind} title={section.title} documents={documents.filter((item) => item.kind === section.kind)} onOpen={(id) => void open(token, id, setSelected, setError)} />
      ))}
      {selected !== null ? <DocumentEditor token={token} detail={selected} onChange={async () => { await reload(); await refresh(token, selected.id, setSelected); }} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function Section({ title, documents, onOpen }: { title: string; documents: readonly DocumentSummaryDto[]; onOpen: (id: string) => void }) {
  return (
    <section>
      <h2 className="text-lg font-medium">{title}</h2>
      {documents.length === 0 ? <p className="text-sm text-hira-muted">None yet.</p> : null}
      <ul className="mt-2 space-y-1">
        {documents.map((document) => <DocumentRow key={document.id} document={document} onOpen={onOpen} />)}
      </ul>
    </section>
  );
}

function DocumentRow({ document, onOpen }: { document: DocumentSummaryDto; onOpen: (id: string) => void }) {
  const parsed = parseStatusLabel(document.parseStatus);
  return (
    <li>
      <button type="button" className="text-left text-hira-accent" onClick={() => onOpen(document.id)}>
        {document.title}
        {document.isPinned ? ' · Pinned' : ''}
        {parsed !== null ? ` · ${parsed}` : ''}
      </button>
    </li>
  );
}

function UploadResume({ token, onDone, onError }: { token: string; onDone: () => Promise<void>; onError: (value: string | null) => void }) {
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => void upload(event, token, onDone, onError)}>
      <label className="text-sm text-hira-muted">
        Resume PDF
        <input className="mt-1 block text-hira-text" name="file" type="file" accept="application/pdf,.pdf" />
      </label>
      <Button type="submit">Upload</Button>
    </form>
  );
}

function CreateText({ token, onDone, onError }: { token: string; onDone: () => Promise<void>; onError: (value: string | null) => void }) {
  return (
    <form className="space-y-3" onSubmit={(event) => void create(event, token, onDone, onError)}>
      <label className="block text-sm text-hira-muted">
        Kind
        <select name="kind" className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" defaultValue={DocumentKind.Note}>
          {TEXT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
        </select>
      </label>
      <TextField label="Title" name="title" required />
      <label className="block text-sm text-hira-muted">
        Format
        <select name="format" className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" defaultValue={DocumentFormat.Md}>
          <option value={DocumentFormat.Md}>Markdown</option>
          <option value={DocumentFormat.Txt}>Text</option>
        </select>
      </label>
      <label className="block text-sm text-hira-muted">
        Text
        <textarea name="content" className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" rows={4} required />
      </label>
      <Button type="submit">Create file</Button>
    </form>
  );
}

async function upload(event: FormEvent<HTMLFormElement>, token: string, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  event.preventDefault();
  const file = new FormData(event.currentTarget).get('file');
  if (!(file instanceof File) || file.size === 0) {
    onError('Choose a PDF resume');
    return;
  }
  const message = await uploadResume(token, file);
  onError(message);
  if (message !== null) return;
  event.currentTarget.reset();
  await onDone();
  await useSuggestions.getState().reload(token);
}

async function create(event: FormEvent<HTMLFormElement>, token: string, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const message = await createTextDocument(token, {
    kind: String(data.get('kind')) as DocumentKind,
    title: String(data.get('title') ?? ''),
    format: String(data.get('format')) as DocumentFormat,
    content: String(data.get('content') ?? ''),
  });
  onError(message);
  if (message !== null) return;
  event.currentTarget.reset();
  await onDone();
}

async function open(token: string, id: string, setSelected: (detail: DocumentDetailDto | null) => void, onError: (value: string | null) => void): Promise<void> {
  const detail = await fetchDocument(token, id);
  if (detail === null) onError('Could not open the file');
  else setSelected(detail);
}

async function refresh(token: string, id: string, setSelected: (detail: DocumentDetailDto | null) => void): Promise<void> {
  const detail = await fetchDocument(token, id);
  if (detail !== null) setSelected(detail);
}
