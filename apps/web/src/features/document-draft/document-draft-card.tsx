'use client';

import { DocumentFormat, DocumentKind, type DocumentDraftDto } from '@hira/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { MarkdownText } from '../../common/components/markdown-text';
import { TextField } from '../../common/components/text-field';
import { documentKindLabel } from '../../common/utils/enum-labels';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { TEXT_KINDS } from '../library/library.constants';
import { saveDraftAsNew, replaceWithDraft, type DraftEdits } from './save-draft';

type DraftPhase = { kind: 'editing' } | { kind: 'saving' } | { kind: 'saved'; replaced: boolean } | { kind: 'dismissed' };

const FIELD_CLASS = 'mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text';

/** File text Hira proposed. Nothing is written until the user saves it (ADR-024). */
export function DocumentDraftCard({ draft }: { draft: DocumentDraftDto }) {
  const account = useSession((state) => state.status) === SessionStatus.Account;
  const [edits, setEdits] = useState<DraftEdits>({ title: draft.title, format: draft.format, kind: DocumentKind.Note });
  const [phase, setPhase] = useState<DraftPhase>({ kind: 'editing' });
  const [error, setError] = useState<string | null>(null);
  if (phase.kind === 'dismissed') return null;
  const run = (replace: boolean) => void save(draft, edits, replace, setPhase, setError);
  return (
    <section className="mt-3 space-y-3 rounded-lg border border-hira-accent/40 bg-hira-bg/60 p-3" aria-label="Draft from Hira">
      <p className="text-sm font-medium">Draft from Hira</p>
      {phase.kind === 'saved' ? <SavedNote replaced={phase.replaced} /> : <DraftFields edits={edits} onChange={setEdits} />}
      <Preview draft={draft} format={edits.format} />
      {error !== null ? <p role="alert" className="text-sm">{error}</p> : null}
      {phase.kind === 'saved' ? null : (
        <DraftActions draft={draft} account={account} busy={phase.kind === 'saving'} onSave={run} onDismiss={() => setPhase({ kind: 'dismissed' })} />
      )}
    </section>
  );
}

function DraftFields({ edits, onChange }: { edits: DraftEdits; onChange: (next: DraftEdits) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_8rem_8rem]">
      <TextField label="Title" value={edits.title} onChange={(event) => onChange({ ...edits, title: event.target.value })} />
      <label className="block text-sm text-hira-muted">
        Format
        <select className={FIELD_CLASS} value={edits.format} onChange={(event) => onChange({ ...edits, format: event.target.value as DocumentFormat })}>
          <option value={DocumentFormat.Md}>Markdown</option>
          <option value={DocumentFormat.Txt}>Text</option>
        </select>
      </label>
      <label className="block text-sm text-hira-muted">
        Kind
        <select className={FIELD_CLASS} value={edits.kind} onChange={(event) => onChange({ ...edits, kind: event.target.value as DocumentKind })}>
          {TEXT_KINDS.map((kind) => <option key={kind} value={kind}>{documentKindLabel(kind)}</option>)}
        </select>
      </label>
    </div>
  );
}

function Preview({ draft, format }: { draft: DocumentDraftDto; format: DocumentFormat }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-hira-muted">Preview ({draft.content.length} characters)</summary>
      <div className="mt-2 max-h-64 overflow-y-auto rounded-md bg-black/30 p-3">
        {format === DocumentFormat.Md ? <MarkdownText text={draft.content} /> : <p className="whitespace-pre-wrap">{draft.content}</p>}
      </div>
    </details>
  );
}

function DraftActions({ draft, account, busy, onSave, onDismiss }: { draft: DocumentDraftDto; account: boolean; busy: boolean; onSave: (replace: boolean) => void; onDismiss: () => void }) {
  if (!account) {
    return (
      <p className="text-sm text-hira-muted">
        <Link className="text-hira-accent underline" href="/login">Sign in</Link> to save drafts to your library.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy} onClick={() => onSave(false)}>{busy ? 'Saving…' : 'Save as new'}</Button>
      {draft.targetDocumentId !== null ? (
        <Button type="button" tone="quiet" disabled={busy} onClick={() => onSave(true)}>Replace {draft.targetTitle ?? 'file'}</Button>
      ) : null}
      <Button type="button" tone="quiet" disabled={busy} onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

function SavedNote({ replaced }: { replaced: boolean }) {
  return (
    <p className="text-sm" role="status">
      {replaced ? 'File updated.' : 'Saved to your library.'}{' '}
      <Link className="text-hira-accent underline" href="/library">Open library</Link>
    </p>
  );
}

async function save(
  draft: DocumentDraftDto,
  edits: DraftEdits,
  replace: boolean,
  setPhase: (phase: DraftPhase) => void,
  setError: (value: string | null) => void,
): Promise<void> {
  setPhase({ kind: 'saving' });
  setError(null);
  const message = replace ? await replaceWithDraft(draft, edits.title) : await saveDraftAsNew(draft, edits);
  setError(message);
  setPhase(message === null ? { kind: 'saved', replaced: replace } : { kind: 'editing' });
}
