'use client';

import { DocumentFormat, type DocumentDetailDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { deleteDocument, patchDocument } from './library-api';

interface DocumentEditorProps {
  token: string;
  detail: DocumentDetailDto;
  onChange: () => Promise<void>;
  onClose: () => void;
}

/** Reads a PDF and edits Markdown or text. Saving a PDF body is not offered. */
export function DocumentEditor({ token, detail, onChange, onClose }: DocumentEditorProps) {
  const locked = detail.format === DocumentFormat.Pdf;
  const [title, setTitle] = useState(detail.title);
  const [content, setContent] = useState(detail.extractedText);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setTitle(detail.title);
    setContent(detail.extractedText);
    setConfirming(false);
  }, [detail]);
  return (
    <section className="space-y-3 rounded-lg border border-white/10 p-4">
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <label className="block text-sm text-hira-muted">
        Text
        <textarea className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" rows={10} value={content} readOnly={locked} onChange={(event) => setContent(event.target.value)} />
      </label>
      {locked ? <p className="text-sm text-hira-muted">PDF text is read-only. The file stays in the library.</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void save(token, detail, title, content, locked, setError, onChange)}>Save</Button>
        <Button type="button" tone="quiet" onClick={() => void pin(token, detail, setError, onChange)}>{detail.isPinned ? 'Unpin' : 'Pin'}</Button>
        <Button type="button" tone="quiet" onClick={() => void remove(token, detail.id, confirming, setConfirming, setError, onChange, onClose)}>
          {confirming ? 'Confirm delete' : 'Delete'}
        </Button>
      </div>
    </section>
  );
}

async function save(
  token: string,
  detail: DocumentDetailDto,
  title: string,
  content: string,
  locked: boolean,
  setError: (value: string | null) => void,
  onChange: () => Promise<void>,
): Promise<void> {
  const message = await patchDocument(token, detail.id, locked ? { title } : { title, content });
  setError(message);
  if (message === null) await onChange();
}

async function pin(token: string, detail: DocumentDetailDto, setError: (value: string | null) => void, onChange: () => Promise<void>): Promise<void> {
  const message = await patchDocument(token, detail.id, { isPinned: !detail.isPinned });
  setError(message);
  if (message === null) await onChange();
}

async function remove(
  token: string,
  id: string,
  confirming: boolean,
  setConfirming: (value: boolean) => void,
  setError: (value: string | null) => void,
  onChange: () => Promise<void>,
  onClose: () => void,
): Promise<void> {
  if (!confirming) {
    setConfirming(true);
    return;
  }
  const ok = await deleteDocument(token, id);
  setError(ok ? null : 'Could not delete the file');
  if (!ok) return;
  onClose();
  await onChange();
}
