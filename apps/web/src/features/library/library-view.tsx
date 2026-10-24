'use client';

import { AuthorKind, DocumentFormat, DocumentKind, type DocumentDetailDto, type DocumentSummaryDto } from '@hira/contracts';
import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { documentKindLabel } from '../../common/utils/enum-labels';
import { useSession } from '../auth/session.store';
import { useSuggestions } from '../suggestions/suggestion.store';
import { DocumentEditor } from './document-editor';
import { createTextDocument, fetchDocument, fetchDocuments, uploadResume } from './library-api';
import { LIBRARY_SECTIONS, TEXT_KINDS, parseStatusLabel } from './library.constants';

type OnError = (value: string | null) => void;
const SELECT_CLASS = 'mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text';

/** Files grouped by kind. A PDF resume can offer skills after upload. */
export function LibraryView() {
  const token = useSession((state) => state.accessToken);
  const [documents, setDocuments] = useState<DocumentSummaryDto[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [selected, setSelected] = useState<DocumentDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const next = await fetchDocuments().catch(() => null);
    setListFailed(next === null);
    if (next !== null) setDocuments(next);
  }, []);
  useEffect(() => {
    if (token !== null) void reload();
  }, [token, reload]);
  if (token === null) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Library</h1>
      <UploadResume onDone={reload} onError={setError} />
      <CreateText onDone={reload} onError={setError} />
      {error !== null ? <p role="alert">{error}</p> : null}
      <DocumentSections documents={documents} failed={listFailed} onRetry={() => void reload()} onOpen={(id) => void open(id, setSelected, setError)} />
      {selected !== null ? (
        <DocumentEditor
          detail={selected}
          onChange={async () => {
            await reload();
            await refresh(selected.id, setSelected);
          }}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function DocumentSections({ documents, failed, onRetry, onOpen }: { documents: readonly DocumentSummaryDto[] | null; failed: boolean; onRetry: () => void; onOpen: (id: string) => void }) {
  if (failed) {
    return (
      <div role="alert" className="space-y-2 text-sm">
        <p>Could not load your files.</p>
        <Button type="button" tone="quiet" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (documents === null) return <p className="text-sm text-hira-muted">Loading…</p>;
  return (
    <>
      {LIBRARY_SECTIONS.map((section) => (
        <Section key={section.kind} title={section.title} documents={documents.filter((item) => item.kind === section.kind)} onOpen={onOpen} />
      ))}
    </>
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
      {document.createdBy === AuthorKind.Assistant ? <span className="ml-2 rounded-full bg-hira-accent/30 px-2 py-0.5 text-xs">by Hira</span> : null}
    </li>
  );
}

function UploadResume({ onDone, onError }: { onDone: () => Promise<void>; onError: OnError }) {
  const [busy, setBusy] = useState(false);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    void upload(event.currentTarget, onDone, onError).finally(() => setBusy(false));
  };
  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit} aria-busy={busy}>
      <label className="text-sm text-hira-muted">
        Resume PDF
        <input className="mt-1 block text-hira-text" name="file" type="file" accept="application/pdf,.pdf" disabled={busy} />
      </label>
      <Button type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Upload'}</Button>
    </form>
  );
}

function CreateText({ onDone, onError }: { onDone: () => Promise<void>; onError: OnError }) {
  return (
    <form className="space-y-3" onSubmit={(event) => void create(event, onDone, onError)}>
      <label className="block text-sm text-hira-muted">
        Kind
        <select name="kind" className={SELECT_CLASS} defaultValue={DocumentKind.Note}>
          {TEXT_KINDS.map((kind) => <option key={kind} value={kind}>{documentKindLabel(kind)}</option>)}
        </select>
      </label>
      <TextField label="Title" name="title" required />
      <label className="block text-sm text-hira-muted">
        Format
        <select name="format" className={SELECT_CLASS} defaultValue={DocumentFormat.Md}>
          <option value={DocumentFormat.Md}>Markdown</option>
          <option value={DocumentFormat.Txt}>Text</option>
        </select>
      </label>
      <label className="block text-sm text-hira-muted">
        Text
        <textarea name="content" className={SELECT_CLASS} rows={4} required />
      </label>
      <Button type="submit">Create file</Button>
    </form>
  );
}

async function upload(form: HTMLFormElement, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const file = new FormData(form).get('file');
  if (!(file instanceof File) || file.size === 0) return onError('Choose a PDF resume');
  const message = await uploadResume(file).catch(() => 'Could not reach Hira');
  onError(message);
  if (message !== null) return;
  form.reset();
  await onDone();
  await useSuggestions.getState().reload();
  useSuggestions.getState().setResumeBatch(true);
}

async function create(event: FormEvent<HTMLFormElement>, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const message = await createTextDocument({
    kind: String(data.get('kind')) as DocumentKind,
    title: String(data.get('title') ?? ''),
    format: String(data.get('format')) as DocumentFormat,
    content: String(data.get('content') ?? ''),
  }).catch(() => 'Could not reach Hira');
  onError(message);
  if (message !== null) return;
  form.reset();
  await onDone();
}

async function open(id: string, setSelected: (detail: DocumentDetailDto | null) => void, onError: OnError): Promise<void> {
  const detail = await fetchDocument(id).catch(() => null);
  if (detail === null) onError('Could not open the file');
  else setSelected(detail);
}

async function refresh(id: string, setSelected: (detail: DocumentDetailDto | null) => void): Promise<void> {
  const detail = await fetchDocument(id).catch(() => null);
  if (detail !== null) setSelected(detail);
}
