'use client';

import { isRemovedVacancySummary, type CollectionDto, type FavoriteDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { TextField } from '../../common/components/text-field';
import { workFormatLabel } from '../../common/utils/enum-labels';
import { useVacancyDetail } from '../vacancy/vacancy-detail.store';
import { ForeignRemoteBadge, PostingLink } from '../vacancy/vacancy-links';
import { deleteFavorite, patchFavorite } from './favorites-api';
import { favoriteClosed, favoritePay } from './favorite-card';
import { useSavedVacancies } from './saved-vacancies.store';

type OnError = (value: string | null) => void;

interface FavoriteCardProps {
  favorite: FavoriteDto;
  collections: readonly CollectionDto[];
  onDone: () => Promise<void>;
  onError: OnError;
}

/** One saved vacancy. The title opens the same detail drawer as the chat card. */
export function FavoriteCard({ favorite, collections, onDone, onError }: FavoriteCardProps) {
  const vacancy = favorite.vacancy;
  const removed = isRemovedVacancySummary(vacancy);
  const openDetail = useVacancyDetail((state) => state.open);
  return (
    <article className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="font-medium">
        {removed ? vacancy.title : <button type="button" className="text-left hover:underline" onClick={() => openDetail(vacancy.id)}>{vacancy.title}</button>}
      </h3>
      <p className="text-sm text-hira-muted">{vacancy.companyName}{vacancy.locationLabel !== null ? ` · ${vacancy.locationLabel}` : ''}</p>
      <p className="text-sm text-hira-muted">{favoritePay(vacancy)}{vacancy.workFormat !== null ? ` · ${workFormatLabel(vacancy.workFormat)}` : ''}</p>
      <div className="flex flex-wrap items-center gap-3">
        <ForeignRemoteBadge show={vacancy.isForeignRemote === true} />
        {removed ? null : <PostingLink url={vacancy.url} closed={favoriteClosed(vacancy)} />}
      </div>
      <NoteField favorite={favorite} onDone={onDone} onError={onError} />
      <CollectionSelect favorite={favorite} collections={collections} onDone={onDone} onError={onError} />
      <button type="button" className="text-sm text-hira-muted" onClick={() => void removeFavorite(favorite, onDone, onError)}>Remove</button>
    </article>
  );
}

function NoteField({ favorite, onDone, onError }: Omit<FavoriteCardProps, 'collections'>) {
  const [note, setNote] = useState(favorite.note ?? '');
  useEffect(() => setNote(favorite.note ?? ''), [favorite.note]);
  return <TextField label="Note" value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => void saveNote(favorite, note, onDone, onError)} />;
}

function CollectionSelect({ favorite, collections, onDone, onError }: FavoriteCardProps) {
  return (
    <label className="block text-sm text-hira-muted">
      Collection
      <select
        className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text"
        value={favorite.collectionId ?? ''}
        onChange={(event) => void move(favorite.id, event.target.value, onDone, onError)}
      >
        <option value="">Uncategorized</option>
        {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
      </select>
    </label>
  );
}

async function saveNote(favorite: FavoriteDto, note: string, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  if ((favorite.note ?? '') === note.trim()) return;
  const message = await patchFavorite(favorite.id, { note }).catch(() => 'Could not reach Hira');
  onError(message);
  if (message === null) await onDone();
}

async function move(id: string, collectionId: string, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const message = await patchFavorite(id, { collectionId: collectionId === '' ? null : collectionId }).catch(() => 'Could not reach Hira');
  onError(message);
  if (message === null) await onDone();
}

async function removeFavorite(favorite: FavoriteDto, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const ok = await deleteFavorite(favorite.id).catch(() => false);
  onError(ok ? null : 'Could not remove the favorite');
  if (!ok) return;
  useSavedVacancies.getState().forgetVacancy(favorite.vacancyId);
  await onDone();
}
