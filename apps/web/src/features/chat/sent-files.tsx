'use client';

import type { MessageAttachment } from '@hira/contracts';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { AlertText } from '../../common/components/feedback';
import { uploadAndOffer } from '../library/upload-resume';
import { useAttachments } from './attachments.store';

/** Files of a user message as chips. A resume-like PDF sent from this tab can still go to the profile. */
export function SentFiles({ attachments }: { attachments: readonly MessageAttachment[] }) {
  return (
    <ul className="mb-1 flex max-w-bubble-max flex-col items-end gap-1" aria-label="Attached files">
      {attachments.map((attachment, index) => (
        <li key={`${attachment.name}-${index}`} className="flex flex-col items-end gap-1">
          <span className="flex max-w-full items-center gap-2 rounded-field bg-surface-control px-3 py-1.5 text-sm">
            <FileText className="size-icon-sm shrink-0 text-ink-tertiary" aria-hidden="true" />
            <span className="min-w-0 truncate">{attachment.name}</span>
          </span>
          <AddAsResume name={attachment.name} />
        </li>
      ))}
    </ul>
  );
}

/** Hira offers it in words; this button does it: the PDF is uploaded as the resume and its skills are offered. */
function AddAsResume({ name }: { name: string }) {
  const sent = useAttachments((state) => state.sent[name]);
  const [state, setState] = useState<'idle' | 'adding' | 'done'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  if (sent === undefined || !sent.looksLikeResume || !isPdf(sent.file) || state === 'done') return null;
  const add = async () => {
    setState('adding');
    const result = await uploadAndOffer(sent.file);
    setMessage(result);
    setState(result === null ? 'done' : 'idle');
  };
  return (
    <>
      <Button variant="secondary" size="sm" disabled={state === 'adding'} onClick={() => void add()}>
        {state === 'adding' ? 'Adding…' : 'Add as resume'}
      </Button>
      {message !== null ? <AlertText>{message}</AlertText> : null}
    </>
  );
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}
