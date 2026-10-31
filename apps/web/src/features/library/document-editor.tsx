'use client';

import { DocumentFormat, type DocumentDetailDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { ConfirmDialog } from '../../common/components/confirm-dialog';
import { AlertText, MutedText } from '../../common/components/feedback';
import { TextArea, TextField } from '../../common/components/text-field';
import { deleteDocument, patchDocument } from './library-api';

interface DocumentEditorProps {
  detail: DocumentDetailDto;
  onChange: () => Promise<void>;
  onClose: () => void;
}

type OnError = (value: string | null) => void;

/** Reads a PDF and edits Markdown or text. Saving a PDF body is not offered. */
export function DocumentEditor({ detail, onChange, onClose }: DocumentEditorProps) {
  const locked = detail.format === DocumentFormat.Pdf;
  const [title, setTitle] = useState(detail.title);
  const [content, setContent] = useState(detail.extractedText);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setTitle(detail.title);
    setContent(detail.extractedText);
  }, [detail]);
  return (
    <section className="mt-3 space-y-4" aria-label={`Edit ${detail.title}`}>
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <TextArea label="Text" rows={10} value={content} readOnly={locked} onChange={(event) => setContent(event.target.value)} />
      {locked ? <MutedText>PDF text is read-only. The file stays in the library.</MutedText> : null}
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="danger" className="mr-auto" onClick={() => setConfirming(true)}>Delete</Button>
        <Button variant="secondary" onClick={() => void patch(detail.id, { isPinned: !detail.isPinned }, setError, onChange)}>{detail.isPinned ? 'Unpin' : 'Pin'}</Button>
        <Button onClick={() => void patch(detail.id, locked ? { title } : { title, content }, setError, onChange)}>Save</Button>
      </div>
      <ConfirmDialog open={confirming} title="Delete file?" body={`This will delete “${detail.title}”.`} confirmLabel="Delete" onConfirm={() => void remove(detail.id, setError, onChange, onClose)} onClose={() => setConfirming(false)} />
    </section>
  );
}

async function patch(id: string, body: Parameters<typeof patchDocument>[1], setError: OnError, onChange: () => Promise<void>): Promise<void> {
  const message = await patchDocument(id, body).catch(() => 'Could not reach Hira');
  setError(message);
  if (message === null) await onChange();
}

async function remove(id: string, setError: OnError, onChange: () => Promise<void>, onClose: () => void): Promise<void> {
  const ok = await deleteDocument(id).catch(() => false);
  setError(ok ? null : 'Could not delete the file');
  if (!ok) return;
  onClose();
  await onChange();
}
