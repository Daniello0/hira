'use client';

import { useEffect, useState } from 'react';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { createFavorite, deleteFavorite } from '../favorites/favorites-api';
import { useSavedVacancies } from '../favorites/saved-vacancies.store';
import { nextFavoriteToggle, type FavoriteToggleState } from './favorite-toggle-state';

/** Save or unsave a vacancy from a card. Hidden for a demo session. */
export function FavoriteToggle({ vacancyId }: { vacancyId: string }) {
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  const favoriteId = useSavedVacancies((state) => state.byVacancy[vacancyId]);
  const [phase, setPhase] = useState<FavoriteToggleState>(favoriteId === undefined ? 'idle' : 'saved');
  useEffect(() => {
    setPhase(favoriteId === undefined ? 'idle' : 'saved');
  }, [favoriteId]);
  if (status !== SessionStatus.Account || token === null) return null;
  return (
    <button type="button" className="text-sm text-hira-accent" disabled={phase === 'saving'} onClick={() => void toggle(token, vacancyId, favoriteId, phase, setPhase)}>
      {label(phase)}
    </button>
  );
}

function label(phase: FavoriteToggleState): string {
  if (phase === 'saving') return 'Saving…';
  if (phase === 'saved') return 'Saved';
  if (phase === 'error') return 'Could not save';
  return 'Save';
}

async function toggle(
  token: string,
  vacancyId: string,
  favoriteId: string | undefined,
  phase: FavoriteToggleState,
  setPhase: (phase: FavoriteToggleState) => void,
): Promise<void> {
  const next = nextFavoriteToggle(phase, 'submit');
  if (next === phase) return;
  setPhase(next);
  if (favoriteId !== undefined) {
    const ok = await deleteFavorite(token, favoriteId);
    setPhase(nextFavoriteToggle('saving', ok ? 'cleared' : 'fail'));
    if (ok) useSavedVacancies.getState().forgetVacancy(vacancyId);
    return;
  }
  const saved = await createFavorite(token, { vacancyId });
  setPhase(nextFavoriteToggle('saving', saved === null ? 'fail' : 'saved'));
  if (saved !== null) useSavedVacancies.getState().remember(saved);
}
