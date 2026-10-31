'use client';

import { isRemovedVacancySummary, type CollectionDto, type FavoriteDto } from '@hira/contracts';
import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { IconButton } from '../../common/components/icon-button';
import { Select } from '../../common/components/select';
import { TextField } from '../../common/components/text-field';
import { useLeaving } from '../../common/hooks/use-leaving';
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
  const { leaving, leave } = useLeaving();
  return (
    <article data-leaving={leaving} className="motion-row motion-enter space-y-3 rounded-card border border-line-light bg-surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-medium">
          {removed ? vacancy.title : <button type="button" className="text-left transition-colors hover:text-link" onClick={() => openDetail(vacancy.id)}>{vacancy.title}</button>}
        </h3>
        <IconButton label="Remove" shape="action" onClick={() => void removeFavorite(favorite, leave, onDone, onError)}><Trash2 size={18} aria-hidden="true" /></IconButton>
      </div>
      <div className="text-sm text-ink-secondary">
        <p>{vacancy.companyName}{vacancy.locationLabel !== null ? ` · ${vacancy.locationLabel}` : ''}</p>
        <p>{favoritePay(vacancy)}{vacancy.workFormat !== null ? ` · ${workFormatLabel(vacancy.workFormat)}` : ''}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ForeignRemoteBadge show={vacancy.isForeignRemote === true} />
        {removed ? null : <PostingLink url={vacancy.url} closed={favoriteClosed(vacancy)} />}
      </div>
      <NoteField favorite={favorite} onDone={onDone} onError={onError} />
      <CollectionSelect favorite={favorite} collections={collections} onDone={onDone} onError={onError} />
    </article>
  );
}

function NoteField({ favorite, onDone, onError }: Omit<FavoriteCardProps, 'collections'>) {
  const [note, setNote] = useState(favorite.note ?? '');
  useEffect(() => setNote(favorite.note ?? ''), [favorite.note]);
  return <TextField id={`note-${favorite.id}`} label="Note" value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => void saveNote(favorite, note, onDone, onError)} />;
}

function CollectionSelect({ favorite, collections, onDone, onError }: FavoriteCardProps) {
  const options = [{ value: '', label: 'Uncategorized' }, ...collections.map((collection) => ({ value: collection.id, label: collection.name }))];
  return <Select label="Collection" value={favorite.collectionId ?? ''} options={options} onChange={(value) => void move(favorite.id, value, onDone, onError)} />;
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

async function removeFavorite(favorite: FavoriteDto, leave: (remove: () => void) => void, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const ok = await deleteFavorite(favorite.id).catch(() => false);
  onError(ok ? null : 'Could not remove the favorite');
  if (!ok) return;
  useSavedVacancies.getState().forgetVacancy(favorite.vacancyId);
  leave(() => void onDone());
}
