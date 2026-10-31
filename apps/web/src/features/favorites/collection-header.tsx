'use client';

import { Ellipsis, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../../common/components/confirm-dialog';
import { IconButton } from '../../common/components/icon-button';
import { Menu } from '../../common/components/menu';
import { SectionHeading } from '../../common/components/page-frame';
import { deleteCollection, patchCollection } from './favorites-api';
import type { FavoriteGroup } from './favorite-groups';

type OnError = (value: string | null) => void;

/** Collection name with Rename and Delete. The default list and Uncategorized are fixed. */
export function CollectionHeader({ group, onDone, onError }: { group: FavoriteGroup; onDone: () => Promise<void>; onError: OnError }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const editable = group.id !== null && !group.isDefault;
  return (
    <div className="flex items-center justify-between gap-3">
      {editing && group.id !== null ? (
        <RenameInput id={group.id} name={group.name} onDone={onDone} onError={onError} onClose={() => setEditing(false)} />
      ) : (
        <SectionHeading>{group.name}</SectionHeading>
      )}
      {editable && group.id !== null && !editing ? (
        <Menu
          align="end"
          tooltip="Collection actions"
          trigger={<IconButton label="Collection actions" tooltip={false} shape="action"><Ellipsis className="size-icon-md" aria-hidden="true" /></IconButton>}
          entries={[
            { kind: 'item', label: 'Rename', icon: <Pencil className="size-icon-md" aria-hidden="true" />, onSelect: () => setEditing(true) },
            { kind: 'item', label: 'Delete collection', danger: true, icon: <Trash2 className="size-icon-md" aria-hidden="true" />, onSelect: () => setConfirming(true) },
          ]}
        />
      ) : null}
      <ConfirmDialog open={confirming} title="Delete collection?" body={`This will delete “${group.name}”.`} confirmLabel="Delete" onConfirm={() => void removeCollection(group.id ?? '', onDone, onError)} onClose={() => setConfirming(false)} />
    </div>
  );
}

function RenameInput({ id, name, onDone, onError, onClose }: { id: string; name: string; onDone: () => Promise<void>; onError: OnError; onClose: () => void }) {
  const [value, setValue] = useState(name);
  return (
    <input
      aria-label="Collection name"
      autoFocus
      className="h-control flex-1 rounded-field border border-accent-focus bg-transparent px-2 text-base text-ink outline-none"
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
