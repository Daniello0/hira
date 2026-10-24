'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CurrentUserDto, MemoryFactDto } from '@hira/contracts';
import { Button } from '../../common/components/button';
import { useConfirm } from '../../common/hooks/use-confirm';
import { useSession } from '../auth/session.store';
import { fetchMemory, forgetAllMemory, patchMemorySettings } from './memory-api';
import { MemoryRow } from './memory-row';

const OFF_COPY = 'Saved facts stay in this list. Hira will not read or write them until you turn cross-chat memory back on. The current chat keeps its own history.';
const ON_COPY = 'Hira can use these facts in new chats.';

type OnError = (value: string | null) => void;

/** Facts Hira stored, and the account switch that stops cross-chat use. */
export function MemoryView() {
  const token = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  const [facts, setFacts] = useState<MemoryFactDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const reload = useCallback(async () => {
    const next = await fetchMemory().catch(() => null);
    if (next === null) setError('Could not load memory');
    else setFacts(next);
  }, []);
  useEffect(() => {
    if (token !== null) void reload();
  }, [token, reload]);
  if (token === null || user === null) return null;
  const enabled = user.crossChatMemoryEnabled;
  const onForgetAll = () => {
    if (!confirm.armed) return confirm.arm();
    confirm.reset();
    void forgetAll(setError, reload);
  };
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Memory</h1>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={() => void toggle(!enabled, user, setError)} />
        Cross-chat memory
      </label>
      <p className="text-sm text-hira-muted">{enabled ? ON_COPY : OFF_COPY}</p>
      {error !== null ? <p role="alert">{error}</p> : null}
      <FactList facts={facts} onChange={reload} />
      {facts !== null ? (
        <Button type="button" tone="quiet" onClick={onForgetAll} onBlur={confirm.reset}>
          {confirm.armed ? 'Confirm forget all' : 'Forget all'}
        </Button>
      ) : null}
    </div>
  );
}

function FactList({ facts, onChange }: { facts: readonly MemoryFactDto[] | null; onChange: () => Promise<void> }) {
  if (facts === null) return <p className="text-sm text-hira-muted">Loading…</p>;
  if (facts.length === 0) return <p className="text-sm text-hira-muted">Nothing is stored yet.</p>;
  return (
    <ul className="space-y-3">
      {facts.map((fact) => <MemoryRow key={fact.id} fact={fact} onChange={onChange} />)}
    </ul>
  );
}

async function toggle(enabled: boolean, user: CurrentUserDto, setError: OnError): Promise<void> {
  const saved = await patchMemorySettings({ crossChatMemory: enabled }).catch(() => null);
  if (saved === null) return setError('Could not update cross-chat memory');
  setError(null);
  useSession.getState().patchUser({ ...user, crossChatMemoryEnabled: saved.crossChatMemory });
}

async function forgetAll(setError: OnError, reload: () => Promise<void>): Promise<void> {
  const ok = await forgetAllMemory().catch(() => false);
  setError(ok ? null : 'Could not forget the facts');
  if (ok) await reload();
}
