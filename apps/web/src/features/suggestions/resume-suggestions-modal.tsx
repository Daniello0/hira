'use client';

import { ProfileSkillSource, type ProfileSuggestionDto } from '@hira/contracts';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Checkbox } from '../../common/components/checkbox';
import { Dialog } from '../../common/components/dialog';
import { AlertText, MutedText } from '../../common/components/feedback';
import { useLastDefined } from '../../common/hooks/use-last-defined';
import { suggestionCanAccept, suggestionTitle, suggestionValue } from './format-suggestion';
import { useSuggestions } from './suggestion.store';

const BATCH_FAILED = 'Some items could not be updated. They stay in the list.';

/** After a resume upload: every offer from the resume in one checklist. Unchecked items are dismissed. */
export function ResumeSuggestionsModal() {
  const open = useSuggestions((state) => state.resumeBatch);
  const items = useSuggestions((state) => state.items);
  const setBatch = useSuggestions((state) => state.setResumeBatch);
  const fromResume = items.filter((item) => item.source === ProfileSkillSource.ExtractedFromResume);
  const visible = open && fromResume.length > 0;
  const shown = useLastDefined(visible ? fromResume : null);
  const close = () => setBatch(false);
  return (
    <Dialog open={visible} title="Found in your resume" onClose={close}>
      {shown !== null ? <ResumeChecklist items={shown} onClose={close} /> : null}
    </Dialog>
  );
}

function ResumeChecklist({ items, onClose }: { items: readonly ProfileSuggestionDto[]; onClose: () => void }) {
  const [checked, setChecked] = useState<string[]>(() => items.filter(suggestionCanAccept).map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (id: string) => setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  const submit = () => void applyBatch(items, checked, setBusy, setError, onClose);
  return (
    <>
      <MutedText className="mt-2">Choose what to add to your profile. Unchecked items are dismissed.</MutedText>
      <ul className="scroll-thin mt-3 max-h-list-max space-y-2 overflow-y-auto">
        {items.map((item) => <ChecklistRow key={item.id} item={item} checked={checked.includes(item.id)} onToggle={() => toggle(item.id)} />)}
      </ul>
      {error !== null ? <AlertText className="mt-2">{error}</AlertText> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={onClose}>Later</Button>
        <Button disabled={busy} onClick={submit}>{busy ? 'Saving…' : `Add selected (${checked.length})`}</Button>
      </div>
    </>
  );
}

function ChecklistRow({ item, checked, onToggle }: { item: ProfileSuggestionDto; checked: boolean; onToggle: () => void }) {
  const canAccept = suggestionCanAccept(item);
  return (
    <li>
      <Checkbox checked={checked && canAccept} disabled={!canAccept} onChange={onToggle}>
        {suggestionValue(item) ?? suggestionTitle(item)}
        {canAccept ? null : <span className="block text-xs text-ink-tertiary">Not in the skill catalog yet</span>}
      </Checkbox>
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
