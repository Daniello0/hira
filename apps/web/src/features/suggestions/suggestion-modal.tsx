'use client';

import type { ProfileSuggestionDto } from '@hira/contracts';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Modal } from '../../common/components/modal';
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
  if (item === undefined || batch) return null;
  return <SuggestionDialog key={item.id} item={item} />;
}

function SuggestionDialog({ item }: { item: ProfileSuggestionDto }) {
  const accept = useSuggestions((state) => state.accept);
  const dismiss = useSuggestions((state) => state.dismiss);
  const defer = useSuggestions((state) => state.defer);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canAccept = suggestionCanAccept(item);
  const value = suggestionValue(item);
  const run = (action: (id: string) => Promise<boolean>) => void settle(action, item.id, setBusy, setError);
  return (
    <Modal title={suggestionTitle(item)} onClose={() => defer(item.id)}>
      {value !== null ? <p className="mt-2 rounded-md bg-black/30 px-3 py-2 text-sm">{value}</p> : null}
      {canAccept ? null : <p className="mt-2 text-sm text-hira-muted">{SKILL_NOT_IN_CATALOG}</p>}
      {error !== null ? <p className="mt-2 text-sm" role="alert">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" disabled={!canAccept || busy} onClick={() => run(accept)}>Add</Button>
        <Button type="button" tone="quiet" disabled={busy} onClick={() => run(dismiss)}>Dismiss</Button>
      </div>
    </Modal>
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
