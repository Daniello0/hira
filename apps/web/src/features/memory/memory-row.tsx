'use client';

import type { MemoryFactDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { forgetMemory, patchMemory } from './memory-api';
import { confidenceLabel, memoryKindLabel } from './memory-labels';
import { MemorySourceLink } from './memory-source-link';

/** One fact: pin, edit, or forget. */
export function MemoryRow({ fact, onChange }: { fact: MemoryFactDto; onChange: () => Promise<void> }) {
  const [draft, setDraft] = useState(fact.content);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setDraft(fact.content), [fact.content]);
  return (
    <li className="space-y-2 rounded-lg border border-white/10 p-3">
      <p className="text-sm text-hira-muted">{memoryKindLabel(fact.kind)} · {confidenceLabel(fact.confidence)} · {new Date(fact.createdAt).toLocaleDateString('en')}</p>
      <label className="block text-sm text-hira-muted">
        Wording
        <textarea className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <p className="text-xs text-hira-muted"><MemorySourceLink fact={fact} /></p>
      {error !== null ? <p role="alert">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" tone="quiet" onClick={() => void save(fact.id, draft, setError, onChange)}>Save</Button>
        <Button type="button" tone="quiet" onClick={() => void pin(fact, setError, onChange)}>{fact.isPinned ? 'Unpin' : 'Pin'}</Button>
        <Button type="button" tone="quiet" onClick={() => void forget(fact.id, setError, onChange)}>Forget</Button>
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

async function forget(id: string, setError: (value: string | null) => void, onChange: () => Promise<void>): Promise<void> {
  const ok = await forgetMemory(id).catch(() => false);
  setError(ok ? null : 'Could not forget the fact');
  if (ok) await onChange();
}
