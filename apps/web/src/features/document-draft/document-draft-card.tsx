'use client';

import { DocumentFormat, DocumentKind, type DocumentDraftDto } from '@hira/contracts';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Collapsible } from '../../common/components/collapsible';
import { AlertText } from '../../common/components/feedback';
import { MarkdownText } from '../../common/components/markdown-text';
import { Select } from '../../common/components/select';
import { TextField } from '../../common/components/text-field';
import { documentKindLabel } from '../../common/utils/enum-labels';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { TEXT_KINDS } from '../library/library.constants';
import { saveDraftAsNew, replaceWithDraft, type DraftEdits } from './save-draft';

type DraftPhase = { kind: 'editing' } | { kind: 'saving' } | { kind: 'saved'; replaced: boolean } | { kind: 'dismissed' };

/** File text Hira proposed. Nothing is written until the user saves it (ADR-024). */
export function DocumentDraftCard({ draft }: { draft: DocumentDraftDto }) {
  const account = useSession((state) => state.status) === SessionStatus.Account;
  const [edits, setEdits] = useState<DraftEdits>({ title: draft.title, format: draft.format, kind: DocumentKind.Note });
  const [phase, setPhase] = useState<DraftPhase>({ kind: 'editing' });
  const [error, setError] = useState<string | null>(null);
  if (phase.kind === 'dismissed') return null;
  const run = (replace: boolean) => void save(draft, edits, replace, setPhase, setError);
  return (
    <section className="motion-enter mt-3 space-y-3 rounded-card border border-line bg-surface-card p-4" aria-label="Draft from Hira">
      <p className="text-sm font-medium">Draft from Hira</p>
      {phase.kind === 'saved' ? <SavedNote replaced={phase.replaced} /> : <DraftFields edits={edits} onChange={setEdits} />}
      <Preview draft={draft} format={edits.format} />
      {error !== null ? <AlertText>{error}</AlertText> : null}
      {phase.kind === 'saved' ? null : (
        <DraftActions draft={draft} account={account} busy={phase.kind === 'saving'} onSave={run} onDismiss={() => setPhase({ kind: 'dismissed' })} />
      )}
    </section>
  );
}

function DraftFields({ edits, onChange }: { edits: DraftEdits; onChange: (next: DraftEdits) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <TextField className="min-w-0 flex-1 basis-full md:basis-0" label="Title" value={edits.title} onChange={(event) => onChange({ ...edits, title: event.target.value })} />
      <Select label="Format" value={edits.format} options={[{ value: DocumentFormat.Md, label: 'Markdown' }, { value: DocumentFormat.Txt, label: 'Text' }]} onChange={(value) => onChange({ ...edits, format: value as DocumentFormat })} />
      <Select label="Kind" value={edits.kind} options={TEXT_KINDS.map((kind) => ({ value: kind, label: documentKindLabel(kind) }))} onChange={(value) => onChange({ ...edits, kind: value as DocumentKind })} />
    </div>
  );
}

function Preview({ draft, format }: { draft: DocumentDraftDto; format: DocumentFormat }) {
  return (
    <Collapsible summary={`Preview (${draft.content.length} characters)`}>
      <div className="scroll-thin mt-2 max-h-preview-max overflow-y-auto rounded-field bg-surface-control p-3 text-sm">
        {format === DocumentFormat.Md ? <MarkdownText text={draft.content} /> : <p className="whitespace-pre-wrap">{draft.content}</p>}
      </div>
    </Collapsible>
  );
}

function DraftActions({ draft, account, busy, onSave, onDismiss }: { draft: DocumentDraftDto; account: boolean; busy: boolean; onSave: (replace: boolean) => void; onDismiss: () => void }) {
  if (!account) {
    return (
      <p className="text-sm text-ink-tertiary">
        <Link className="text-link underline" href="/login">Sign in</Link> to save drafts to your library.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" disabled={busy} onClick={() => onSave(false)}>{busy ? 'Saving…' : 'Save as new'}</Button>
      {draft.targetDocumentId !== null ? (
        <Button type="button" variant="secondary" disabled={busy} onClick={() => onSave(true)}>Replace {draft.targetTitle ?? 'file'}</Button>
      ) : null}
      <Button type="button" variant="secondary" disabled={busy} onClick={onDismiss}>Dismiss</Button>
    </div>
  );
}

function SavedNote({ replaced }: { replaced: boolean }) {
  return (
    <p className="text-sm" role="status">
      {replaced ? 'File updated.' : 'Saved to your library.'}{' '}
      <Link className="text-link underline" href="/library">Open library</Link>
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
