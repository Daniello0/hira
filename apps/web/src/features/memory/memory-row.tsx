'use client';

import type { MemoryFactDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { AlertText, MutedText } from '../../common/components/feedback';
import { TextArea } from '../../common/components/text-field';
import { useLeaving } from '../../common/hooks/use-leaving';
import { forgetMemory, patchMemory } from './memory-api';
import { confidenceLabel, memoryKindLabel } from './memory-labels';
import { MemorySourceLink } from './memory-source-link';

/** One fact: pin, edit, or forget. */
export function MemoryRow({ fact, onChange }: { fact: MemoryFactDto; onChange: () => Promise<void> }) {
  const [draft, setDraft] = useState(fact.content);
  const [error, setError] = useState<string | null>(null);
  const { leaving, leave } = useLeaving();
  useEffect(() => setDraft(fact.content), [fact.content]);
  return (
    <li data-leaving={leaving} className="motion-row motion-enter space-y-3 rounded-card border border-line p-4">
      <MutedText>{memoryKindLabel(fact.kind)} · {confidenceLabel(fact.confidence)} · {new Date(fact.createdAt).toLocaleDateString('en')}</MutedText>
      <TextArea label="Wording" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} />
      <p className="text-xs text-ink-tertiary"><MemorySourceLink fact={fact} /></p>
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void save(fact.id, draft, setError, onChange)}>Save</Button>
        <Button variant="secondary" size="sm" onClick={() => void pin(fact, setError, onChange)}>{fact.isPinned ? 'Unpin' : 'Pin'}</Button>
        <Button variant="danger" size="sm" onClick={() => void forget(fact.id, setError, leave, onChange)}>Forget</Button>
      </div>
    </li>
  );
}

async function save(id: string, content: string, setError: (value: string | null) => void, onChange: () => Promise<void>): Promise<void> {
  if (content.trim().length === 0) {
    setError('Write the fact before saving');
    return;
  }
  const updated = await patchMemory(id, { content: content.trim() }).catch(() => null);
  setError(updated === null ? 'Could not save the fact' : null);
  if (updated !== null) await onChange();
}

async function pin(fact: MemoryFactDto, setError: (value: string | null) => void, onChange: () => Promise<void>): Promise<void> {
  const updated = await patchMemory(fact.id, { isPinned: !fact.isPinned }).catch(() => null);
  setError(updated === null ? 'Could not update the pin' : null);
  if (updated !== null) await onChange();
}

async function forget(id: string, setError: (value: string | null) => void, leave: (remove: () => void) => void, onChange: () => Promise<void>): Promise<void> {
  const ok = await forgetMemory(id).catch(() => false);
  setError(ok ? null : 'Could not forget the fact');
  if (ok) leave(() => void onChange());
}
