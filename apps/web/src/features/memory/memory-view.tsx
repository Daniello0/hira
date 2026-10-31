'use client';

import { useCallback, useEffect, useState } from 'react';
import { PLAN_LIMITS, type CurrentUserDto, type MemoryFactDto } from '@hira/contracts';
import { Button } from '../../common/components/button';
import { RowCard, SettingsRow } from '../../common/components/card';
import { ConfirmDialog } from '../../common/components/confirm-dialog';
import { AlertText, MutedText, SkeletonList } from '../../common/components/feedback';
import { PageHeading } from '../../common/components/page-frame';
import { Switch } from '../../common/components/switch';
import { invalidate, useDataVersion } from '../../common/data/data-version.store';
import { useSession } from '../auth/session.store';
import { fetchMemory, forgetAllMemory, patchMemorySettings } from './memory-api';
import { MemoryRow } from './memory-row';

const OFF_COPY = 'Saved facts stay in this list. Hira will not read or write them until you turn cross-chat memory back on. The current chat keeps its own history.';
const ON_COPY = 'Hira can use these facts in new chats.';
const PLAN_COPY = 'Cross-chat memory is part of the Pro plan. Saved facts stay in this list. Upgrade under Billing to turn it on.';

type OnError = (value: string | null) => void;

/** Facts Hira stored, and the account switch that stops cross-chat use. */
export function MemoryView() {
  const token = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  const [facts, setFacts] = useState<MemoryFactDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const version = useDataVersion('memory');
  const reload = useCallback(async () => {
    const next = await fetchMemory().catch(() => null);
    if (next === null) setError('Could not load memory');
    else setFacts(next);
  }, []);
  useEffect(() => {
    if (token !== null) void reload();
  }, [token, reload, version]);
  if (token === null || user === null) return null;
  const allowed = PLAN_LIMITS[user.plan].crossChatMemory;
  const enabled = allowed && user.crossChatMemoryEnabled;
  return (
    <>
      <PageHeading title="Memory" />
      <RowCard>
        <SettingsRow label="Cross-chat memory" description={memoryCopy(allowed, enabled)}>
          <Switch label="Cross-chat memory" checked={enabled} disabled={!allowed} onChange={() => void toggle(!enabled, user, setError)} />
        </SettingsRow>
      </RowCard>
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <FactList facts={facts} onChange={reload} />
      {facts !== null && facts.length > 0 ? <Button variant="danger" onClick={() => setConfirming(true)}>Forget all</Button> : null}
      <ConfirmDialog open={confirming} title="Forget everything?" body="Hira will lose every saved fact. This cannot be undone." confirmLabel="Forget all" onConfirm={() => void forgetAll(setError, reload)} onClose={() => setConfirming(false)} />
    </>
  );
}

function memoryCopy(allowed: boolean, enabled: boolean): string {
  if (!allowed) return PLAN_COPY;
  return enabled ? ON_COPY : OFF_COPY;
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
  invalidate('account');
}

async function forgetAll(setError: OnError, reload: () => Promise<void>): Promise<void> {
  const ok = await forgetAllMemory().catch(() => false);
  setError(ok ? null : 'Could not forget the facts');
  if (ok) await reload();
}
