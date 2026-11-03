'use client';

import { MAX_MESSAGE_ATTACHMENTS, type MessageAttachment, type ReadAttachmentDto } from '@hira/contracts';
import { create } from 'zustand';
import { authedFetch } from '../../common/api/authed-fetch';
import { readApiMessage } from '../auth/read-api-message';

/** What the file picker and a drop take: what the server reads. */
export const ATTACHMENT_ACCEPT = '.pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.yaml,.yml,.html,.htm,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*,text/*';
export const TOO_MANY_FILES = `A message can carry ${MAX_MESSAGE_ATTACHMENTS} files`;
export const FILES_STILL_READING = 'Hira is still reading the files. Send once they are ready.';

/** A file in the composer: read to text on the server before it can go. */
export interface ComposerFile {
  id: string;
  file: File;
  status: 'reading' | 'ready' | 'failed';
  read: ReadAttachmentDto | null;
  error: string | null;
}

interface AttachmentState {
  files: ComposerFile[];
  /** Files sent from this tab by name, so the chat can still add a resume-like PDF to the profile. */
  sent: Record<string, { file: File; looksLikeResume: boolean }>;
  add: (files: readonly File[]) => string | null;
  remove: (id: string) => void;
  /** The read files for the next message; the composer is emptied. */
  take: () => MessageAttachment[];
}

let nextId = 0;

/** Files waiting in the composer. One composer is on screen at a time, so one list serves the home screen and a chat. */
export const useAttachments = create<AttachmentState>((set, get) => ({
  files: [],
  sent: {},
  add: (chosen) => {
    const room = MAX_MESSAGE_ATTACHMENTS - get().files.length;
    const taken = chosen.slice(0, Math.max(0, room)).map((file) => ({ id: `file-${(nextId += 1)}`, file, status: 'reading' as const, read: null, error: null }));
    set({ files: [...get().files, ...taken] });
    for (const item of taken) void readInto(item, set, get);
    return chosen.length > taken.length ? TOO_MANY_FILES : null;
  },
  remove: (id) => set({ files: get().files.filter((item) => item.id !== id) }),
  take: () => {
    const ready = get().files.filter((item) => item.status === 'ready' && item.read !== null);
    const sent = { ...get().sent };
    for (const item of ready) sent[(item.read as ReadAttachmentDto).name] = { file: item.file, looksLikeResume: (item.read as ReadAttachmentDto).looksLikeResume };
    set({ files: [], sent });
    return ready.map((item) => ({ name: (item.read as ReadAttachmentDto).name, text: (item.read as ReadAttachmentDto).text }));
  },
}));

/** True while a file is still being read: the message waits for it. */
export function filesStillReading(files: readonly ComposerFile[]): boolean {
  return files.some((item) => item.status === 'reading');
}

async function readInto(item: ComposerFile, set: (partial: Partial<AttachmentState>) => void, get: () => AttachmentState): Promise<void> {
  const update = (patch: Partial<ComposerFile>) => set({ files: get().files.map((file) => (file.id === item.id ? { ...file, ...patch } : file)) });
  try {
    const body = new FormData();
    body.append('file', item.file, item.file.name);
    const response = await authedFetch('/api/v1/documents/read', { method: 'POST', body });
    if (!response.ok) return update({ status: 'failed', error: await readApiMessage(response, 'Could not read the file') });
    update({ status: 'ready', read: (await response.json()) as ReadAttachmentDto });
  } catch {
    update({ status: 'failed', error: 'Could not reach Hira' });
  }
}
