'use client';

import type { ChatSummary } from '@hira/contracts';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { ConfirmDialog } from '../../common/components/confirm-dialog';
import { Menu } from '../../common/components/menu';
import { setChatArchived } from './chat-actions';

interface ChatActionsMenuProps {
  chat: ChatSummary;
  trigger: ReactElement;
  tooltip?: string;
  align?: 'start' | 'end';
  onRename: () => void;
  /** Runs after the user confirms deletion. */
  onDelete: () => void;
  onError: (value: string | null) => void;
}

/** Rename, archive or restore, delete: the same menu in the sidebar row and the chat header. */
export function ChatActionsMenu({ chat, trigger, tooltip, align = 'start', onRename, onDelete, onError }: ChatActionsMenuProps) {
  const [confirming, setConfirming] = useState(false);
  const archived = chat.isArchived;
  return (
    <>
      <Menu
        trigger={trigger}
        tooltip={tooltip}
        align={align}
        entries={[
          { kind: 'item', label: 'Rename', icon: <Pencil className="size-icon-md" aria-hidden="true" />, onSelect: onRename },
          { kind: 'item', label: archived ? 'Restore' : 'Archive', icon: archived ? <ArchiveRestore className="size-icon-md" aria-hidden="true" /> : <Archive className="size-icon-md" aria-hidden="true" />, onSelect: () => void setChatArchived(chat, !archived, onError) },
          { kind: 'item', label: 'Delete', danger: true, icon: <Trash2 className="size-icon-md" aria-hidden="true" />, onSelect: () => setConfirming(true) },
        ]}
      />
      <ConfirmDialog
        open={confirming}
        title="Delete chat?"
        body={`This will delete “${chat.title ?? 'New chat'}”.`}
        confirmLabel="Delete"
        onConfirm={onDelete}
        onClose={() => setConfirming(false)}
      />
    </>
  );
}
