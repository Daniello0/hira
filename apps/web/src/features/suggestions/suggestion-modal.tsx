'use client';

import type { ProfileSuggestionDto } from '@hira/contracts';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Dialog } from '../../common/components/dialog';
import { AlertText, MutedText } from '../../common/components/feedback';
import { useLastDefined } from '../../common/hooks/use-last-defined';
import { SKILL_NOT_IN_CATALOG, suggestionCanAccept, suggestionTitle, suggestionValue } from './format-suggestion';
import { nextVisibleSuggestion, useSuggestions } from './suggestion.store';
import { SUGGESTION_UPDATE_FAILED } from './suggestions.constants';

/**
 * One pending offer. Add and Dismiss settle it; Escape or the backdrop only hide it in this tab.
 * Hidden while the resume checklist is open.
 */
export function SuggestionModal() {
  const item = useSuggestions((state) => nextVisibleSuggestion(state));
  const batch = useSuggestions((state) => state.resumeBatch);
  const shown = useLastDefined(item);
  const defer = useSuggestions((state) => state.defer);
  const open = item !== undefined && !batch;
  return (
    <Dialog open={open} title={shown !== null ? suggestionTitle(shown) : ''} onClose={() => { if (item !== undefined) defer(item.id); }}>
      {shown !== null ? <SuggestionBody key={shown.id} item={shown} /> : null}
    </Dialog>
  );
}

function SuggestionBody({ item }: { item: ProfileSuggestionDto }) {
  const accept = useSuggestions((state) => state.accept);
  const dismiss = useSuggestions((state) => state.dismiss);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canAccept = suggestionCanAccept(item);
  const value = suggestionValue(item);
  const run = (action: (id: string) => Promise<boolean>) => void settle(action, item.id, setBusy, setError);
  return (
    <>
      {value !== null ? <p className="mt-2 rounded-field bg-surface-control px-3 py-2 text-sm">{value}</p> : null}
      {canAccept ? null : <MutedText className="mt-2">{SKILL_NOT_IN_CATALOG}</MutedText>}
      {error !== null ? <AlertText className="mt-2">{error}</AlertText> : null}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => run(dismiss)}>Dismiss</Button>
        <Button disabled={!canAccept || busy} onClick={() => run(accept)}>Add</Button>
      </div>
    </>
  );
}

async function settle(
  action: (id: string) => Promise<boolean>,
  id: string,
  setBusy: (value: boolean) => void,
  setError: (value: string | null) => void,
): Promise<void> {
  setBusy(true);
  setError(null);
  const ok = await action(id);
  setBusy(false);
  if (!ok) setError(SUGGESTION_UPDATE_FAILED);
}
