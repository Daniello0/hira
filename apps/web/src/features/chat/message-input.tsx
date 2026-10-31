'use client';

import { ArrowUp, AudioLines, Mic } from 'lucide-react';
import Link from 'next/link';
import type { KeyboardEvent } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';
import { AlertText } from '../../common/components/feedback';
import { IconButton, iconButtonClass } from '../../common/components/icon-button';
import { Tooltip } from '../../common/components/tooltip';
import { ComposerMenu } from './composer-menu';
import { SignUpLinks } from './sign-up-links';
import { useDictation } from './use-dictation';

interface MessageInputProps {
  draft: string;
  disabled: boolean;
  archived: boolean;
  banner: string | null;
  notice: string | null;
  account: boolean;
  useMemory: boolean;
  includeForeignRemote: boolean;
  onUseMemory: (value: boolean) => void;
  onIncludeForeignRemote: (value: boolean) => void;
  onDraft: (value: string) => void;
  onSend: () => void;
}

/** Height of one line of text in the pill. A taller field moves the controls under the text. */
const SINGLE_LINE_PX = 40;

/** Composer. Enter sends, Shift+Enter adds a line. It stays disabled until the stream is idle. */
export function MessageInput(props: MessageInputProps) {
  const { draft, disabled, archived, onDraft, onSend } = props;
  const box = useRef<HTMLDivElement>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const dictation = useDictation(draft, onDraft);
  const { field, expanded } = useGrowingField(draft);
  return (
    <form className="w-full" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <StatusLine banner={props.banner} notice={props.notice ?? menuError ?? dictation.error} account={props.account} />
      {archived ? <p className="mb-2 text-center text-sm text-ink-tertiary">This chat is archived. Restore it from the menu to keep writing.</p> : null}
      <div ref={box} data-expanded={expanded} className="flex flex-wrap items-end gap-1 rounded-composer-tall bg-surface-raised p-2 shadow-composer transition-colors md:rounded-composer md:data-[expanded=true]:rounded-composer-tall">
        <ComposerMenu box={box} account={props.account} useMemory={props.useMemory} includeForeignRemote={props.includeForeignRemote} onUseMemory={props.onUseMemory} onIncludeForeignRemote={props.onIncludeForeignRemote} onError={setMenuError} />
        <label className="sr-only" htmlFor="message">Message</label>
        <textarea
          ref={field}
          id="message"
          value={draft}
          disabled={disabled || archived}
          rows={1}
          data-expanded={expanded}
          className="scroll-thin order-first max-h-list-max min-h-control basis-full resize-none bg-transparent px-2 py-composer-y text-message text-ink outline-none placeholder:text-ink-tertiary disabled:opacity-60 md:order-none md:basis-0 md:flex-1 md:data-[expanded=true]:order-first md:data-[expanded=true]:basis-full"
          placeholder={archived ? 'Archived chat' : 'Ask Hira'}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => submitOnEnter(event, onSend)}
        />
        <div className="ml-auto flex items-center gap-1">
          {dictation.available ? (
            <IconButton label={dictation.listening ? 'Stop dictation' : 'Dictate'} shape="round" tone={dictation.listening ? 'active' : 'muted'} disabled={disabled || archived} className={dictation.listening ? 'motion-pulse' : ''} onClick={dictation.toggle}>
              <Mic size={20} aria-hidden="true" />
            </IconButton>
          ) : null}
          <PrimaryAction hasText={draft.trim().length > 0} disabled={disabled || archived} />
        </div>
      </div>
    </form>
  );
}

/** Same spot, two actions: an empty field offers the voice call, text turns it into Send. */
function PrimaryAction({ hasText, disabled }: { hasText: boolean; disabled: boolean }) {
  if (hasText) {
    return (
      <IconButton key="send" label="Send" type="submit" shape="round" tone="accent" disabled={disabled} className="motion-fade">
        <ArrowUp size={20} aria-hidden="true" />
      </IconButton>
    );
  }
  return (
    <Tooltip label="Start a call">
      <Link key="call" href="/call" aria-label="Start a call" className={`motion-fade ${iconButtonClass('round', 'accent')}`}>
        <AudioLines size={20} aria-hidden="true" />
      </Link>
    </Tooltip>
  );
}

/** Grows with the text. Once tall, the field keeps the wide layout until the draft is emptied. */
function useGrowingField(draft: string) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [expanded, setExpanded] = useState(false);
  useLayoutEffect(() => {
    const node = field.current;
    if (node === null) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
    if (draft.length === 0) setExpanded(false);
    else if (draft.includes('\n') || node.scrollHeight > SINGLE_LINE_PX) setExpanded(true);
  }, [draft]);
  return { field, expanded };
}

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>, onSend: () => void): void {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  onSend();
}

function StatusLine({ banner, notice, account }: { banner: string | null; notice: string | null; account: boolean }) {
  if (banner === null && notice === null) return null;
  return (
    <div className="mb-2 space-y-1 text-center text-sm">
      {banner !== null && !account ? <SignUpLinks /> : null}
      {banner !== null && account ? <p>Search quota exceeded</p> : null}
      {notice !== null ? <AlertText>{notice}</AlertText> : null}
    </div>
  );
}
