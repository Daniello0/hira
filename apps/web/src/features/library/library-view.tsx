'use client';

import { AuthorKind, DocumentFormat, DocumentKind, type DocumentDetailDto, type DocumentSummaryDto } from '@hira/contracts';
import { FileText, Plus, Upload } from 'lucide-react';
import type { FormEvent } from 'react';
import { useDataVersion } from '../../common/data/data-version.store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '../../common/components/badge';
import { Button } from '../../common/components/button';
import { Collapsible } from '../../common/components/collapsible';
import { Dialog } from '../../common/components/dialog';
import { AlertText, MutedText, SkeletonList } from '../../common/components/feedback';
import { PageColumn, PageHeading } from '../../common/components/page-frame';
import { Select } from '../../common/components/select';
import { TextArea, TextField } from '../../common/components/text-field';
import { useLastDefined } from '../../common/hooks/use-last-defined';
import { documentKindLabel } from '../../common/utils/enum-labels';
import { useSession } from '../auth/session.store';
import { DocumentEditor } from './document-editor';
import { createTextDocument, fetchDocument, fetchDocuments } from './library-api';
import { LIBRARY_SECTIONS, TEXT_KINDS, parseStatusLabel } from './library.constants';
import { uploadAndOffer } from './upload-resume';

type OnError = (value: string | null) => void;

/** Files grouped by kind. A PDF resume can offer skills after upload. */
export function LibraryView() {
  const token = useSession((state) => state.accessToken);
  const [documents, setDocuments] = useState<DocumentSummaryDto[] | null>(null);
  const [listFailed, setListFailed] = useState(false);
  const [selected, setSelected] = useState<DocumentDetailDto | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useDataVersion('library');
  const reload = useCallback(async () => {
    const next = await fetchDocuments().catch(() => null);
    setListFailed(next === null);
    if (next !== null) setDocuments(next);
  }, []);
  useEffect(() => {
    if (token !== null) void reload();
  }, [token, reload, version]);
  const shown = useLastDefined(selected);
  if (token === null) return null;
  return (
    <PageColumn>
      <PageHeading title="Library">
        <div className="flex flex-wrap gap-2">
          <UploadResume onDone={reload} onError={setError} />
          <Button onClick={() => setCreating(true)}><Plus className="size-icon-sm" aria-hidden="true" /> New file</Button>
        </div>
      </PageHeading>
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <DocumentSections documents={documents} failed={listFailed} onRetry={() => void reload()} onOpen={(id) => void open(id, setSelected, setError)} />
      <Dialog open={creating} title="New file" onClose={() => setCreating(false)}>
        <CreateText onDone={reload} onError={setError} onClose={() => setCreating(false)} />
      </Dialog>
      <Dialog open={selected !== null} title={shown === null ? 'File' : shown.title} onClose={() => setSelected(null)}>
        {shown !== null ? (
          <DocumentEditor
            detail={shown}
            onChange={async () => {
              await reload();
              await refresh(shown.id, setSelected);
            }}
            onClose={() => setSelected(null)}
          />
        ) : null}
      </Dialog>
    </PageColumn>
  );
}

function DocumentSections({ documents, failed, onRetry, onOpen }: { documents: readonly DocumentSummaryDto[] | null; failed: boolean; onRetry: () => void; onOpen: (id: string) => void }) {
  if (failed) {
    return (
      <div className="space-y-2">
        <AlertText>Could not load your files.</AlertText>
        <Button variant="secondary" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  if (documents === null) return <SkeletonList />;
  return (
    <div className="space-y-4">
      {LIBRARY_SECTIONS.map((section) => (
        <Section key={section.kind} title={section.title} documents={documents.filter((item) => item.kind === section.kind)} onOpen={onOpen} />
      ))}
    </div>
  );
}

function Section({ title, documents, onOpen }: { title: string; documents: readonly DocumentSummaryDto[]; onOpen: (id: string) => void }) {
  return (
    <Collapsible defaultOpen summary={<>{title} <span className="text-ink-tertiary">{documents.length}</span></>} triggerClassName="text-base font-medium text-ink">
      {documents.length === 0 ? <MutedText className="mt-1">None yet.</MutedText> : null}
      <ul className="mt-1 space-y-0.5">
        {documents.map((document) => <DocumentRow key={document.id} document={document} onOpen={onOpen} />)}
      </ul>
    </Collapsible>
  );
}

function DocumentRow({ document, onOpen }: { document: DocumentSummaryDto; onOpen: (id: string) => void }) {
  const parsed = parseStatusLabel(document.parseStatus);
  return (
    <li className="motion-enter">
      <button type="button" className="flex min-h-composer w-full items-center gap-3 rounded-menu-item px-3 text-left text-sm text-ink transition-colors hover:bg-hover" onClick={() => onOpen(document.id)}>
        <FileText aria-hidden="true" className="size-icon-md shrink-0 text-ink-tertiary" />
        <span className="min-w-0 flex-1 truncate">{document.title}</span>
        {document.isPinned ? <Badge>Pinned</Badge> : null}
        {parsed !== null ? <Badge>{parsed}</Badge> : null}
        {document.createdBy === AuthorKind.Assistant ? <Badge tone="accent">by Hira</Badge> : null}
      </button>
    </li>
  );
}

function UploadResume({ onDone, onError }: { onDone: () => Promise<void>; onError: OnError }) {
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const onChange = (input: HTMLInputElement) => {
    const chosen = input.files?.[0];
    input.value = '';
    if (chosen === undefined || busy) return;
    setBusy(true);
    void upload(chosen, onDone, onError).finally(() => setBusy(false));
  };
  return (
    <>
      <input ref={file} type="file" hidden aria-label="Resume PDF" accept="application/pdf,.pdf" onChange={(event) => onChange(event.currentTarget)} />
      <Button variant="secondary" disabled={busy} onClick={() => file.current?.click()}>
        <Upload className="size-icon-sm" aria-hidden="true" /> {busy ? 'Uploading…' : 'Upload resume'}
      </Button>
    </>
  );
}

const FORMAT_OPTIONS = [{ value: DocumentFormat.Md, label: 'Markdown' }, { value: DocumentFormat.Txt, label: 'Text' }];

function CreateText({ onDone, onError, onClose }: { onDone: () => Promise<void>; onError: OnError; onClose: () => void }) {
  return (
    <form className="mt-3 space-y-4" onSubmit={(event) => void create(event, onDone, onError, onClose)}>
      <TextField label="Title" name="title" required />
      <div className="flex flex-wrap gap-4">
        <Select label="Kind" name="kind" defaultValue={DocumentKind.Note} options={TEXT_KINDS.map((kind) => ({ value: kind, label: documentKindLabel(kind) }))} />
        <Select label="Format" name="format" defaultValue={DocumentFormat.Md} options={FORMAT_OPTIONS} />
      </div>
      <TextArea label="Text" name="content" rows={6} required />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button type="submit">Create file</Button>
      </div>
    </form>
  );
}

async function upload(file: File, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const message = await uploadAndOffer(file);
  onError(message);
  if (message === null) await onDone();
}

async function create(event: FormEvent<HTMLFormElement>, onDone: () => Promise<void>, onError: OnError, onClose: () => void): Promise<void> {
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
  onClose();
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
