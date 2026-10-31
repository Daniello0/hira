'use client';

import { Brain, FileUp, Globe, Library, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../common/components/icon-button';
import { Menu, type MenuEntry } from '../../common/components/menu';
import { uploadAndOffer } from '../library/upload-resume';

const ICON_SIZE = 18;
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

/** The `+` menu: resume upload, library, and the switches for this message. As wide as the composer. */
export function ComposerMenu({ box, account, useMemory, includeForeignRemote, onUseMemory, onIncludeForeignRemote, onError }: ComposerMenuProps) {
  const file = useRef<HTMLInputElement>(null);
  const width = useElementWidth(box);
  const entries: MenuEntry[] = [
    ...(account ? accountEntries(() => file.current?.click(), useMemory, onUseMemory) : []),
    { kind: 'check', label: 'Show foreign remote', description: 'Remote jobs from employers abroad', icon: <Globe size={ICON_SIZE} aria-hidden="true" />, checked: includeForeignRemote, onChange: onIncludeForeignRemote },
  ];
  return (
    <>
      <input ref={file} type="file" hidden accept="application/pdf,.pdf" aria-label="Upload resume" onChange={(event) => void upload(event.currentTarget, onError)} />
      <Menu
        tooltip="Add files and more"
        matchWidth={width}
        alignOffset={-BOX_PADDING_PX}
        sideOffset={14}
        entries={entries}
        trigger={<IconButton label="Add files and more" tooltip={false} shape="round" tone="plain"><Plus size={20} aria-hidden="true" /></IconButton>}
      />
    </>
  );
}

function accountEntries(onUpload: () => void, useMemory: boolean, onUseMemory: (value: boolean) => void): MenuEntry[] {
  return [
    { kind: 'item', label: 'Upload resume', description: 'PDF, offers skills for your profile', icon: <FileUp size={ICON_SIZE} aria-hidden="true" />, onSelect: onUpload },
    { kind: 'link', label: 'Open library', description: 'Your resumes, letters, and notes', icon: <Library size={ICON_SIZE} aria-hidden="true" />, href: '/library' },
    { kind: 'separator' },
    { kind: 'check', label: 'Use memory', description: 'Let Hira read your saved facts', icon: <Brain size={ICON_SIZE} aria-hidden="true" />, checked: useMemory, onChange: onUseMemory },
  ];
}

async function upload(input: HTMLInputElement, onError: (value: string | null) => void): Promise<void> {
  const chosen = input.files?.[0];
  input.value = '';
  if (chosen === undefined) return;
  onError(await uploadAndOffer(chosen));
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
