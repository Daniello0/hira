'use client';

import { useState } from 'react';
import { Button } from '../../common/components/button';
import { Modal } from '../../common/components/modal';
import { SKILL_NOT_IN_CATALOG, suggestionCanAccept, suggestionTitle } from './format-suggestion';
import { useSuggestions } from './suggestion.store';

/** One pending offer. The next one appears after accept or dismiss. */
export function SuggestionModal({ token }: { token: string }) {
  const item = useSuggestions((state) => state.items[0]);
  const accept = useSuggestions((state) => state.accept);
  const dismiss = useSuggestions((state) => state.dismiss);
  const [error, setError] = useState<string | null>(null);
  if (item === undefined) return null;
  const canAccept = suggestionCanAccept(item);
  return (
    <Modal title={suggestionTitle(item)} onClose={() => void dismiss(token, item.id)}>
      {canAccept ? null : <p className="mt-2 text-sm text-hira-muted">{SKILL_NOT_IN_CATALOG}</p>}
      {error !== null ? <p className="mt-2 text-sm" role="alert">{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <Button type="button" disabled={!canAccept} onClick={() => void run(accept, token, item.id, setError)}>Add</Button>
        <Button type="button" tone="quiet" onClick={() => void run(dismiss, token, item.id, setError)}>Not now</Button>
      </div>
    </Modal>
  );
}

async function run(
  action: (token: string, id: string) => Promise<boolean>,
  token: string,
  id: string,
  setError: (value: string | null) => void,
): Promise<void> {
  setError(null);
  if (!(await action(token, id))) setError('Could not update the suggestion');
}
