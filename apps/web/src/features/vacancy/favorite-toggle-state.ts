export type FavoriteToggleState = 'idle' | 'saving' | 'saved' | 'error';
export type FavoriteToggleEvent = 'submit' | 'saved' | 'cleared' | 'fail';

/** Save button phases. A second click while saving is ignored. */
export function nextFavoriteToggle(state: FavoriteToggleState, event: FavoriteToggleEvent): FavoriteToggleState {
  if (event === 'submit' && state !== 'saving') return 'saving';
  if (event === 'saved') return 'saved';
  if (event === 'cleared') return 'idle';
  if (event === 'fail' && state === 'saving') return 'error';
  return state;
}
