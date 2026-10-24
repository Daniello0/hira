'use client';

import { useState } from 'react';
import { deleteCollection, patchCollection } from './favorites-api';
import type { FavoriteGroup } from './favorite-groups';

type OnError = (value: string | null) => void;

/** Collection name with Rename and Delete. The default list and Uncategorized are fixed. */
export function CollectionHeader({ group, onDone, onError }: { group: FavoriteGroup; onDone: () => Promise<void>; onError: OnError }) {
  const [editing, setEditing] = useState(false);
  const editable = group.id !== null && !group.isDefault;
  return (
    <div className="flex items-center justify-between gap-3">
      {editing && group.id !== null ? (
        <RenameInput id={group.id} name={group.name} onDone={onDone} onError={onError} onClose={() => setEditing(false)} />
      ) : (
        <h2 className="text-lg font-medium">{group.name}</h2>
      )}
      {editable && group.id !== null && !editing ? (
        <div className="flex gap-3 text-sm text-hira-muted">
          <button type="button" onClick={() => setEditing(true)}>Rename</button>
          <button type="button" onClick={() => void removeCollection(group.id ?? '', onDone, onError)}>Delete collection</button>
        </div>
      ) : null}
    </div>
  );
}

function RenameInput({ id, name, onDone, onError, onClose }: { id: string; name: string; onDone: () => Promise<void>; onError: OnError; onClose: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      aria-label="Collection name"
      autoFocus
      className="flex-1 rounded-md border border-white/15 bg-hira-bg px-2 py-1 text-lg"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => void rename(id, name, value, onDone, onError).finally(onClose)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') onClose();
      }}
    />
  );
}

async function rename(id: string, previous: string, value: string, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const name = value.trim();
  if (name.length === 0 || name === previous) return;
  const message = await patchCollection(id, { name }).catch(() => 'Could not reach Hira');
  onError(message);
  if (message === null) await onDone();
}

async function removeCollection(id: string, onDone: () => Promise<void>, onError: OnError): Promise<void> {
  const message = await deleteCollection(id).catch(() => 'Could not reach Hira');
  onError(message);
  if (message === null) await onDone();
}
