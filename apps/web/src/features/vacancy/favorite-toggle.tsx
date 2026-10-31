'use client';

import { PLAN_LIMITS, type UserPlan } from '@hira/contracts';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from '../../common/components/icon-button';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { createFavorite, deleteFavorite } from '../favorites/favorites-api';
import { useSavedVacancies } from '../favorites/saved-vacancies.store';
import { nextFavoriteToggle, type FavoriteToggleState } from './favorite-toggle-state';

type LastAction = 'save' | 'remove' | 'limit';

/** Save or unsave a vacancy from a card. Hidden for a demo session. */
export function FavoriteToggle({ vacancyId }: { vacancyId: string }) {
  const status = useSession((state) => state.status);
  const favoriteId = useSavedVacancies((state) => state.byVacancy[vacancyId]);
  const plan = useSession((state) => state.user?.plan);
  const saved = useSavedVacancies((state) => Object.keys(state.byVacancy).length);
  const [phase, setPhase] = useState<FavoriteToggleState>(favoriteId === undefined ? 'idle' : 'saved');
  const [action, setAction] = useState<LastAction>('save');
  useEffect(() => {
    setPhase(favoriteId === undefined ? 'idle' : 'saved');
  }, [favoriteId]);
  if (status !== SessionStatus.Account) return null;
  const onClick = () => {
    if (favoriteId === undefined && isFull(plan, saved)) {
      setAction('limit');
      setPhase('error');
      return;
    }
    setAction(favoriteId === undefined ? 'save' : 'remove');
    void toggle(vacancyId, favoriteId, phase, setPhase);
  };
  return (
    <>
      {phase === 'error' ? <span role="alert" className="motion-fade text-xs text-danger">{label(phase, action)}</span> : null}
      <IconButton label={phase === 'error' ? 'Try again' : label(phase, action)} shape="action" tone={favoriteId !== undefined ? 'plain' : 'muted'} aria-pressed={favoriteId !== undefined} disabled={phase === 'saving'} onClick={onClick}>
        {favoriteId !== undefined ? <BookmarkCheck className="size-icon-md" aria-hidden="true" /> : <Bookmark className="size-icon-md" aria-hidden="true" />}
      </IconButton>
    </>
  );
}

/** The plan has no room for one more. The server checks this too. */
function isFull(plan: UserPlan | undefined, saved: number): boolean {
  const limit = plan === undefined ? null : PLAN_LIMITS[plan].favorites;
  return limit !== null && saved >= limit;
}

function label(phase: FavoriteToggleState, action: LastAction): string {
  if (phase === 'saving') return action === 'remove' ? 'Removing…' : 'Saving…';
  if (phase === 'saved') return 'Saved';
  if (phase === 'error' && action === 'limit') return 'Limit reached. See Billing';
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
