'use client';

import type { FormEvent } from 'react';
import type { CollectionDto, FavoriteDto } from '@hira/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { useSession } from '../auth/session.store';
import { CLOSED_VACANCY_LABEL } from '../vacancy/vacancy.constants';
import { createCollection, deleteCollection, deleteFavorite, fetchCollections, fetchFavorites, patchFavorite } from './favorites-api';
import { favoriteClosed, favoritePay } from './favorite-card';
import { groupFavorites } from './favorite-groups';
import { useSavedVacancies } from './saved-vacancies.store';

/** Saved vacancies, grouped, with a note search. */
export function FavoritesView() {
  const token = useSession((state) => state.accessToken);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<FavoriteDto[]>([]);
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async (note?: string) => {
    if (token === null) return;
    const [saved, groups] = await Promise.all([fetchFavorites(token, note), fetchCollections(token)]);
    if (saved !== null) {
      setFavorites(saved);
      if (note === undefined || note.trim().length === 0) useSavedVacancies.getState().setAll(saved);
    }
    if (groups !== null) setCollections(groups);
  }, [token]);
  useEffect(() => { void reload(); }, [reload]);
  if (token === null) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Favorites</h1>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void reload(query); }}>
        <TextField label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit">Search</Button>
      </form>
      <NewCollection token={token} onDone={() => reload(query)} onError={setError} />
      {error !== null ? <p role="alert">{error}</p> : null}
      {groupFavorites(favorites, collections).map((group) => (
        <Group key={group.id ?? 'none'} name={group.name} collectionId={group.id} items={group.items} collections={collections} token={token} onDone={() => reload(query)} onError={setError} />
      ))}
    </div>
  );
}

function NewCollection({ token, onDone, onError }: { token: string; onDone: () => Promise<void>; onError: (value: string | null) => void }) {
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void addCollection(event, token, onDone, onError)}>
      <TextField label="New collection" name="name" required />
      <Button type="submit">Create</Button>
    </form>
  );
}

function Group({
  name,
  collectionId,
  items,
  collections,
  token,
  onDone,
  onError,
}: {
  name: string;
  collectionId: string | null;
  items: readonly FavoriteDto[];
  collections: readonly CollectionDto[];
  token: string;
  onDone: () => Promise<void>;
  onError: (value: string | null) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">{name}</h2>
        {collectionId !== null ? <button type="button" className="text-sm text-hira-muted" onClick={() => void removeCollection(token, collectionId, onDone, onError)}>Delete collection</button> : null}
      </div>
      {items.length === 0 ? <p className="text-sm text-hira-muted">No saved vacancies.</p> : null}
      {items.map((favorite) => (
        <FavoriteCard key={favorite.id} favorite={favorite} collections={collections} token={token} onDone={onDone} onError={onError} />
      ))}
    </section>
  );
}

function FavoriteCard({
  favorite,
  collections,
  token,
  onDone,
  onError,
}: {
  favorite: FavoriteDto;
  collections: readonly CollectionDto[];
  token: string;
  onDone: () => Promise<void>;
  onError: (value: string | null) => void;
}) {
  const vacancy = favorite.vacancy;
  return (
    <article className="space-y-2 rounded-lg border border-white/10 p-3">
      <h3 className="font-medium">{vacancy.title}</h3>
      <p className="text-sm text-hira-muted">{vacancy.companyName}{vacancy.locationLabel !== null ? ` · ${vacancy.locationLabel}` : ''}</p>
      <p className="text-sm text-hira-muted">{favoritePay(vacancy)}{vacancy.workFormat !== null ? ` · ${vacancy.workFormat}` : ''}</p>
      {favoriteClosed(vacancy) ? <a className="text-sm underline" href={vacancy.url}>{CLOSED_VACANCY_LABEL}</a> : null}
      <NoteField token={token} favorite={favorite} onDone={onDone} onError={onError} />
      <CollectionSelect token={token} favorite={favorite} collections={collections} onDone={onDone} onError={onError} />
      <button type="button" className="text-sm text-hira-muted" onClick={() => void removeFavorite(token, favorite, onDone, onError)}>Remove</button>
    </article>
  );
}

function NoteField({ token, favorite, onDone, onError }: { token: string; favorite: FavoriteDto; onDone: () => Promise<void>; onError: (value: string | null) => void }) {
  const [note, setNote] = useState(favorite.note ?? '');
  useEffect(() => setNote(favorite.note ?? ''), [favorite.note]);
  return <TextField label="Note" value={note} onChange={(event) => setNote(event.target.value)} onBlur={() => void saveNote(token, favorite, note, onDone, onError)} />;
}

function CollectionSelect({
  token,
  favorite,
  collections,
  onDone,
  onError,
}: {
  token: string;
  favorite: FavoriteDto;
  collections: readonly CollectionDto[];
  onDone: () => Promise<void>;
  onError: (value: string | null) => void;
}) {
  return (
    <label className="block text-sm text-hira-muted">
      Collection
      <select
        className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text"
        value={favorite.collectionId ?? ''}
        onChange={(event) => void move(token, favorite.id, event.target.value, onDone, onError)}
      >
        <option value="">No collection</option>
        {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
      </select>
    </label>
  );
}

async function addCollection(event: FormEvent<HTMLFormElement>, token: string, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  event.preventDefault();
  const name = String(new FormData(event.currentTarget).get('name') ?? '');
  const message = await createCollection(token, name);
  onError(message);
  if (message !== null) return;
  event.currentTarget.reset();
  await onDone();
}

async function saveNote(token: string, favorite: FavoriteDto, note: string, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  if ((favorite.note ?? '') === note.trim()) return;
  const message = await patchFavorite(token, favorite.id, { note });
  onError(message);
  if (message === null) await onDone();
}

async function move(token: string, id: string, collectionId: string, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  const message = await patchFavorite(token, id, { collectionId: collectionId === '' ? null : collectionId });
  onError(message);
  if (message === null) await onDone();
}

async function removeFavorite(token: string, favorite: FavoriteDto, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  const ok = await deleteFavorite(token, favorite.id);
  onError(ok ? null : 'Could not remove the favorite');
  if (!ok) return;
  useSavedVacancies.getState().forgetVacancy(favorite.vacancyId);
  await onDone();
}

async function removeCollection(token: string, id: string, onDone: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  const ok = await deleteCollection(token, id);
  onError(ok ? null : 'Could not delete the collection');
  if (ok) await onDone();
}
