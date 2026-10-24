'use client';

import { DocumentFormat, type DocumentDetailDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { useConfirm } from '../../common/hooks/use-confirm';
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
  const confirm = useConfirm();
  const { reset } = confirm;
  useEffect(() => {
    setTitle(detail.title);
    setContent(detail.extractedText);
    reset();
  }, [detail, reset]);
  const onDelete = () => {
    if (!confirm.armed) return confirm.arm();
    confirm.reset();
    void remove(detail.id, setError, onChange, onClose);
  };
  return (
    <section className="space-y-3 rounded-lg border border-white/10 p-4" aria-label={`Edit ${detail.title}`}>
      <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <label className="block text-sm text-hira-muted">
        Text
        <textarea className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" rows={10} value={content} readOnly={locked} onChange={(event) => setContent(event.target.value)} />
      </label>
      {locked ? <p className="text-sm text-hira-muted">PDF text is read-only. The file stays in the library.</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void patch(detail.id, locked ? { title } : { title, content }, setError, onChange)}>Save</Button>
        <Button type="button" tone="quiet" onClick={() => void patch(detail.id, { isPinned: !detail.isPinned }, setError, onChange)}>{detail.isPinned ? 'Unpin' : 'Pin'}</Button>
        <Button type="button" tone="quiet" onClick={onDelete} onBlur={confirm.reset}>
          {confirm.armed ? 'Confirm delete' : 'Delete'}
        </Button>
        <Button type="button" tone="quiet" onClick={onClose}>Close</Button>
      </div>
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
