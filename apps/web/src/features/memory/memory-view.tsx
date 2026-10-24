'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MemoryFactDto } from '@hira/contracts';
import { Button } from '../../common/components/button';
import { useSession } from '../auth/session.store';
import { fetchMemory, forgetAllMemory, patchMemorySettings } from './memory-api';
import { MemoryRow } from './memory-row';

const OFF_COPY = 'Saved facts stay in this list. Hira will not read or write them until you turn cross-chat memory back on. The current chat keeps its own history.';
const ON_COPY = 'Hira can use these facts in new chats.';

/** Facts Hira stored, and the account switch that stops cross-chat use. */
export function MemoryView() {
  const token = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  const patchUser = useSession((state) => state.patchUser);
  const [facts, setFacts] = useState<MemoryFactDto[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (token === null) return;
    const next = await fetchMemory(token);
    if (next !== null) setFacts(next);
  }, [token]);
  useEffect(() => { void reload(); }, [reload]);
  if (token === null || user === null) return null;
  const enabled = user.crossChatMemoryEnabled;
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Memory</h1>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={() => void toggle(token, !enabled, patchUser, user, setError)} />
        Cross-chat memory
      </label>
      <p className="text-sm text-hira-muted">{enabled ? ON_COPY : OFF_COPY}</p>
      {error !== null ? <p role="alert">{error}</p> : null}
      <ul className="space-y-3">
        {facts.map((fact) => <MemoryRow key={fact.id} fact={fact} token={token} onChange={reload} />)}
      </ul>
      {facts.length === 0 ? <p className="text-sm text-hira-muted">Nothing is stored yet.</p> : null}
      <Button type="button" tone="quiet" onClick={() => void forgetAll(token, confirming, setConfirming, setError, reload)}>
        {confirming ? 'Confirm forget all' : 'Forget all'}
      </Button>
    </div>
  );
}

async function toggle(
  token: string,
  enabled: boolean,
  patchUser: (user: NonNullable<ReturnType<typeof useSession.getState>['user']>) => void,
  user: NonNullable<ReturnType<typeof useSession.getState>['user']>,
  setError: (value: string | null) => void,
): Promise<void> {
  const saved = await patchMemorySettings(token, { crossChatMemory: enabled });
  if (saved === null) {
    setError('Could not update cross-chat memory');
    return;
  }
  setError(null);
  patchUser({ ...user, crossChatMemoryEnabled: saved.crossChatMemory });
}

async function forgetAll(
  token: string,
  confirming: boolean,
  setConfirming: (value: boolean) => void,
  setError: (value: string | null) => void,
  reload: () => Promise<void>,
): Promise<void> {
  if (!confirming) {
    setConfirming(true);
    return;
  }
  const ok = await forgetAllMemory(token);
  setError(ok ? null : 'Could not forget the facts');
  setConfirming(false);
  if (ok) await reload();
}
