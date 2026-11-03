'use client';

import { PLAN_LIMITS } from '@hira/contracts';
import { Brain, FileUp, Globe, Library, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../common/components/icon-button';
import { Menu, type MenuEntry } from '../../common/components/menu';
import { useSession } from '../auth/session.store';
import { ATTACHMENT_ACCEPT, useAttachments } from './attachments.store';

/** The composer's inner padding: the menu lines up with its outer edge. */
const BOX_PADDING_PX = 8;

interface ComposerMenuProps {
  box: RefObject<HTMLDivElement | null>;
  account: boolean;
  useMemory: boolean;
  includeForeignRemote: boolean;
  onUseMemory: (value: boolean) => void;
  onIncludeForeignRemote: (value: boolean) => void;
  onError: (value: string | null) => void;
}

/** The `+` menu: files for Hira to read, library, and the switches for this message. As wide as the composer. */
export function ComposerMenu({ box, account, useMemory, includeForeignRemote, onUseMemory, onIncludeForeignRemote, onError }: ComposerMenuProps) {
  const file = useRef<HTMLInputElement>(null);
  const width = useElementWidth(box);
  const memory = useSession((state) => state.user !== null && PLAN_LIMITS[state.user.plan].crossChatMemory);
  const entries: MenuEntry[] = [
    ...(account ? accountEntries(() => file.current?.click(), memory, useMemory, onUseMemory) : []),
    { kind: 'check', label: 'Show foreign remote', description: 'Remote jobs from employers abroad', icon: <Globe className="size-icon-md" aria-hidden="true" />, checked: includeForeignRemote, onChange: onIncludeForeignRemote },
  ];
  return (
    <>
      <input
        ref={file}
        type="file"
        hidden
        multiple
        accept={ATTACHMENT_ACCEPT}
        aria-label="Upload document"
        onChange={(event) => {
          const input = event.currentTarget;
          onError(useAttachments.getState().add(Array.from(input.files ?? [])));
          input.value = '';
        }}
      />
      <Menu
        tooltip="Add files and more"
        matchWidth={width}
        alignOffset={-BOX_PADDING_PX}
        sideOffset={14}
        entries={entries}
        trigger={<IconButton label="Add files and more" tooltip={false} shape="round" tone="plain"><Plus className="size-icon" aria-hidden="true" /></IconButton>}
      />
    </>
  );
}

function accountEntries(onUpload: () => void, memory: boolean, useMemory: boolean, onUseMemory: (value: boolean) => void): MenuEntry[] {
  return [
    { kind: 'item', label: 'Upload document', description: 'PDF, Word, pictures, CSV, HTML, or text for Hira to read', icon: <FileUp className="size-icon-md" aria-hidden="true" />, onSelect: onUpload },
    { kind: 'link', label: 'Open library', description: 'Your resumes, letters, and notes', icon: <Library className="size-icon-md" aria-hidden="true" />, href: '/library' },
    { kind: 'separator' },
    ...(memory
      ? ([
    { kind: 'check', label: 'Use memory', description: 'Let Hira read your saved facts', icon: <Brain className="size-icon-md" aria-hidden="true" />, checked: useMemory, onChange: onUseMemory },
        ] satisfies MenuEntry[])
      : []),
  ];
}

function useElementWidth(element: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useEffect(() => {
    const node = element.current;
    if (node === null) return;
    const observer = new ResizeObserver(() => setWidth(node.offsetWidth));
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);
  return width;
}
