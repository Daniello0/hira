'use client';

import { ProfileSkillSource, type ProfileSuggestionDto } from '@hira/contracts';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Modal } from '../../common/components/modal';
import { suggestionCanAccept, suggestionTitle, suggestionValue } from './format-suggestion';
import { useSuggestions } from './suggestion.store';

const BATCH_FAILED = 'Some items could not be updated. They stay in the list.';

/** After a resume upload: every offer from the resume in one checklist. Unchecked items are dismissed. */
export function ResumeSuggestionsModal() {
  const open = useSuggestions((state) => state.resumeBatch);
  const items = useSuggestions((state) => state.items);
  const close = useSuggestions((state) => state.setResumeBatch);
  const fromResume = items.filter((item) => item.source === ProfileSkillSource.ExtractedFromResume);
  if (!open || fromResume.length === 0) return null;
  return <ResumeChecklist items={fromResume} onClose={() => close(false)} />;
}

function ResumeChecklist({ items, onClose }: { items: readonly ProfileSuggestionDto[]; onClose: () => void }) {
  const [checked, setChecked] = useState<string[]>(() => items.filter(suggestionCanAccept).map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string) => setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const submit = () => void applyBatch(items, checked, setBusy, setError, onClose);
  return (
    <Modal title="Found in your resume" onClose={onClose}>
      <p className="mt-2 text-sm text-hira-muted">Choose what to add to your profile. Unchecked items are dismissed.</p>
      <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
        {items.map((item) => <ChecklistRow key={item.id} item={item} checked={checked.includes(item.id)} onToggle={() => toggle(item.id)} />)}
      </ul>
      {error !== null ? <p className="mt-2 text-sm" role="alert">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" disabled={busy} onClick={submit}>{busy ? 'Saving…' : `Add selected (${checked.length})`}</Button>
        <Button type="button" tone="quiet" disabled={busy} onClick={onClose}>Later</Button>
      </div>
    </Modal>
  );
}

function ChecklistRow({ item, checked, onToggle }: { item: ProfileSuggestionDto; checked: boolean; onToggle: () => void }) {
  const canAccept = suggestionCanAccept(item);
  return (
    <li>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={checked && canAccept} disabled={!canAccept} onChange={onToggle} />
        <span>
          {suggestionValue(item) ?? suggestionTitle(item)}
          {canAccept ? null : <span className="block text-xs text-hira-muted">Not in the skill catalog yet</span>}
        </span>
      </label>
    </li>
  );
}

async function applyBatch(
  items: readonly ProfileSuggestionDto[],
  checked: readonly string[],
  setBusy: (value: boolean) => void,
  setError: (value: string | null) => void,
  onClose: () => void,
): Promise<void> {
  const store = useSuggestions.getState();
  setBusy(true);
  setError(null);
  const results = await Promise.all(items.map((item) => (checked.includes(item.id) && suggestionCanAccept(item) ? store.accept(item.id) : store.dismiss(item.id))));
  setBusy(false);
  if (results.every(Boolean)) onClose();
  else setError(BATCH_FAILED);
}
