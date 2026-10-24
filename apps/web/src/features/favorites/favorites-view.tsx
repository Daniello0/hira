'use client';

import type { FormEvent } from 'react';
import type { CollectionDto, FavoriteDto } from '@hira/contracts';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { TextField } from '../../common/components/text-field';
import { useSession } from '../auth/session.store';
import { createCollection, fetchCollections, fetchFavorites } from './favorites-api';
import { FavoriteCard } from './favorite-card-view';
import { groupFavorites, type FavoriteGroup } from './favorite-groups';
import { CollectionHeader } from './collection-header';
import { FAVORITES_LOAD_ERROR_MESSAGE, favoritesEmptyMessage } from './favorites.constants';
import { useSavedVacancies } from './saved-vacancies.store';

type OnError = (value: string | null) => void;

interface FavoritesData {
  favorites: FavoriteDto[];
  collections: CollectionDto[];
}

/** Saved vacancies, grouped, with a note search. */
export function FavoritesView() {
  const token = useSession((state) => state.accessToken);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<FavoritesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async (note?: string) => {
    const [saved, groups] = await Promise.all([fetchFavorites(note).catch(() => null), fetchCollections().catch(() => null)]);
    if (saved === null || groups === null) return setError(FAVORITES_LOAD_ERROR_MESSAGE);
    setError(null);
    setData({ favorites: saved, collections: groups });
    if (note === undefined || note.trim().length === 0) useSavedVacancies.getState().setAll(saved);
  }, []);
  useEffect(() => {
    if (token !== null) void reload();
  }, [token, reload]);
  if (token === null) return null;
  const onDone = () => reload(query);
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Favorites</h1>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void reload(query); }}>
        <TextField label="Search notes" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit">Search</Button>
      </form>
      <NewCollection onDone={onDone} onError={setError} />
      {error !== null ? <p role="alert">{error}</p> : null}
      <FavoriteGroups data={data} failed={error !== null} query={query} onDone={onDone} onError={setError} />
    </div>
  );
}

function FavoriteGroups({ data, failed, query, onDone, onError }: { data: FavoritesData | null; failed: boolean; query: string; onDone: () => Promise<void>; onError: OnError }) {
  if (data === null) return failed ? null : <p className="text-sm text-hira-muted">Loading…</p>;
  const emptyMessage = favoritesEmptyMessage(query, data.favorites.length);
  return (
    <>
      {emptyMessage !== null ? <p className="text-sm text-hira-muted">{emptyMessage}</p> : null}
      {groupFavorites(data.favorites, data.collections).map((group) => (
        <Group key={group.id ?? 'none'} group={group} collections={data.collections} onDone={onDone} onError={onError} />
      ))}
    </>
  );
}

function NewCollection({ onDone, onError }: { onDone: () => Promise<void>; onError: OnError }) {
  return (
    <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => void addCollection(event, onDone, onError)}>
      <TextField label="New collection" name="name" required />
      <Button type="submit">Create</Button>
    </form>
  );
}

function Group({ group, collections, onDone, onError }: { group: FavoriteGroup; collections: readonly CollectionDto[]; onDone: () => Promise<void>; onError: OnError }) {
  return (
    <section className="space-y-3">
      <CollectionHeader group={group} onDone={onDone} onError={onError} />
      {group.items.length === 0 ? <p className="text-sm text-hira-muted">No saved vacancies.</p> : null}
      {group.items.map((favorite) => (
        <FavoriteCard key={favorite.id} favorite={favorite} collections={collections} onDone={onDone} onError={onError} />
      ))}
    </section>
  );
}

async function addCollection(event: FormEvent<HTMLFormElement>, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  event.preventDefault();
  const form = event.currentTarget;
  const name = String(new FormData(form).get('name') ?? '');
  const message = await createCollection(name).catch(() => 'Could not reach Hira');
  onError(message);
  if (message !== null) return;
  form.reset();
  await onDone();
}
