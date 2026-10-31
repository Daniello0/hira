'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CurrentUserDto, MemoryFactDto } from '@hira/contracts';
import { Button } from '../../common/components/button';
import { RowCard, SettingsRow } from '../../common/components/card';
import { ConfirmDialog } from '../../common/components/confirm-dialog';
import { AlertText, MutedText, SkeletonList } from '../../common/components/feedback';
import { PageHeading } from '../../common/components/page-frame';
import { Switch } from '../../common/components/switch';
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
  const [confirming, setConfirming] = useState(false);
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
  return (
    <>
      <PageHeading title="Memory" />
      <RowCard>
        <SettingsRow label="Cross-chat memory" description={enabled ? ON_COPY : OFF_COPY}>
          <Switch label="Cross-chat memory" checked={enabled} onChange={() => void toggle(!enabled, user, setError)} />
        </SettingsRow>
      </RowCard>
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <FactList facts={facts} onChange={reload} />
      {facts !== null && facts.length > 0 ? <Button variant="danger" onClick={() => setConfirming(true)}>Forget all</Button> : null}
      <ConfirmDialog open={confirming} title="Forget everything?" body="Hira will lose every saved fact. This cannot be undone." confirmLabel="Forget all" onConfirm={() => void forgetAll(setError, reload)} onClose={() => setConfirming(false)} />
    </>
  );
}

function FactList({ facts, onChange }: { facts: readonly MemoryFactDto[] | null; onChange: () => Promise<void> }) {
  if (facts === null) return <SkeletonList />;
  if (facts.length === 0) return <MutedText>Nothing is stored yet.</MutedText>;
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
