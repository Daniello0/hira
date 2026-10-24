'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { createFavorite, deleteFavorite } from '../favorites/favorites-api';
import { useSavedVacancies } from '../favorites/saved-vacancies.store';
import { nextFavoriteToggle, type FavoriteToggleState } from './favorite-toggle-state';

type LastAction = 'save' | 'remove';

/** Save or unsave a vacancy from a card. Hidden for a demo session. */
export function FavoriteToggle({ vacancyId }: { vacancyId: string }) {
  const status = useSession((state) => state.status);
  const favoriteId = useSavedVacancies((state) => state.byVacancy[vacancyId]);
  const [phase, setPhase] = useState<FavoriteToggleState>(favoriteId === undefined ? 'idle' : 'saved');
  const [action, setAction] = useState<LastAction>('save');
  useEffect(() => {
    setPhase(favoriteId === undefined ? 'idle' : 'saved');
  }, [favoriteId]);
  if (status !== SessionStatus.Account) return null;
  const onClick = () => {
    setAction(favoriteId === undefined ? 'save' : 'remove');
    void toggle(vacancyId, favoriteId, phase, setPhase);
  };
  return (
    <button type="button" className="text-sm text-hira-accent" disabled={phase === 'saving'} onClick={onClick}>
      {label(phase, action)}
    </button>
  );
}

function label(phase: FavoriteToggleState, action: LastAction): string {
  if (phase === 'saving') return action === 'remove' ? 'Removing…' : 'Saving…';
  if (phase === 'saved') return 'Saved';
  if (phase === 'error') return action === 'remove' ? 'Could not remove' : 'Could not save';
  return 'Save';
}

async function toggle(
  vacancyId: string,
  favoriteId: string | undefined,
  phase: FavoriteToggleState,
  setPhase: (phase: FavoriteToggleState) => void,
): Promise<void> {
  const next = nextFavoriteToggle(phase, 'submit');
  if (next === phase) return;
  setPhase(next);
  if (favoriteId !== undefined) {
    const ok = await deleteFavorite(favoriteId).catch(() => false);
    setPhase(nextFavoriteToggle('saving', ok ? 'cleared' : 'fail'));
    if (ok) useSavedVacancies.getState().forgetVacancy(vacancyId);
    return;
  }
  const saved = await createFavorite({ vacancyId }).catch(() => null);
  setPhase(nextFavoriteToggle('saving', saved === null ? 'fail' : 'saved'));
  if (saved !== null) useSavedVacancies.getState().remember(saved);
}
