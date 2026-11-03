'use client';

import { ArrowUp, AudioLines, FileText, Mic, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AlertText } from '../../common/components/feedback';
import { IconButton, iconButtonClass } from '../../common/components/icon-button';
import { Tooltip } from '../../common/components/tooltip';
import { submitOnEnter } from '../../common/utils/submit-on-enter';
import { ComposerMenu } from './composer-menu';
import { filesStillReading, useAttachments, type ComposerFile } from './attachments.store';
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

const SIGN_IN_FOR_FILES = 'Sign in to send files to Hira';

/** Height of one line of text in the pill. A taller field moves the controls under the text. */
const SINGLE_LINE_PX = 40;

/** Composer. Enter sends, Shift+Enter adds a line. It stays disabled until the stream is idle. */
export function MessageInput(props: MessageInputProps) {
  const { draft, disabled, archived, onDraft, onSend } = props;
  const box = useRef<HTMLDivElement>(null);
  const [menuError, setMenuError] = useState<string | null>(null);
  const files = useAttachments((state) => state.files);
  const dictation = useDictation(draft, onDraft);
  const { field, expanded } = useGrowingField(draft);
  const dragging = useFileDrop(props.account && !archived, setMenuError);
  useKeepFocus(field, disabled || archived);
  const ready = files.some((item) => item.status === 'ready');
  return (
    <form className="w-full" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <StatusLine banner={props.banner} notice={props.notice ?? menuError ?? dictation.error} account={props.account} />
      {archived ? <p className="mb-2 text-center text-sm text-ink-tertiary">This chat is archived. Restore it from the menu to keep writing.</p> : null}
      <div ref={box} data-expanded={expanded} data-dragging={dragging} className="flex flex-wrap items-end gap-1 rounded-composer-tall bg-surface-raised p-2 shadow-composer transition-colors data-[dragging=true]:bg-hover md:rounded-composer md:data-[expanded=true]:rounded-composer-tall">
        {files.length > 0 ? <FileChips files={files} /> : null}
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
              <Mic className="size-icon" aria-hidden="true" />
            </IconButton>
          ) : null}
          <PrimaryAction hasText={draft.trim().length > 0 || ready} disabled={disabled || archived || filesStillReading(files)} />
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
        <ArrowUp className="size-icon" aria-hidden="true" />
      </IconButton>
    );
  }
  return (
    <Tooltip label="Start a call">
      <Link key="call" href="/call" aria-label="Start a call" className={`motion-fade ${iconButtonClass('round', 'accent')}`}>
        <AudioLines className="size-icon" aria-hidden="true" />
      </Link>
    </Tooltip>
  );
}

/** Files in the composer: each is read on the server first, and can be taken out before sending. */
function FileChips({ files }: { files: readonly ComposerFile[] }) {
  const remove = useAttachments((state) => state.remove);
  return (
    <ul className="order-first flex basis-full flex-wrap gap-2 px-1 pb-1" aria-label="Files for Hira">
      {files.map((item) => (
        <li key={item.id} className="motion-enter flex max-w-full items-center gap-2 rounded-field bg-surface-control py-1 pr-1 pl-3 text-sm">
          <FileText className="size-icon-sm shrink-0 text-ink-tertiary" aria-hidden="true" />
          <span className="min-w-0 truncate">{item.file.name}</span>
          {item.status === 'reading' ? <span className="motion-shimmer shrink-0">Reading…</span> : null}
          {item.status === 'failed' ? <span className="shrink-0 text-danger">{item.error}</span> : null}
          {item.read?.truncated ? <span className="shrink-0 text-ink-tertiary">Only the start is read</span> : null}
          <IconButton label={`Remove ${item.file.name}`} shape="round" tone="plain" tooltip={false} onClick={() => remove(item.id)}>
            <X className="size-icon-sm" aria-hidden="true" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

/**
 * Files dropped anywhere on the page go to the composer, so a drop never opens the file in place of the app.
 * A guest gets a word instead: reading files needs an account.
 */
function useFileDrop(enabled: boolean, onError: (message: string | null) => void): boolean {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const carriesFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') === true;
    const over = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      setDragging(false);
      onError(enabled ? useAttachments.getState().add(Array.from(event.dataTransfer?.files ?? [])) : SIGN_IN_FOR_FILES);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [enabled, onError]);
  return dragging;
}

/**
 * On a computer the field has the focus when the chat opens and gets it back when Hira's answer ends: it is off
 * while she answers, which drops the focus. A phone keeps its keyboard closed, and focus the user moved elsewhere stays there.
 */
function useKeepFocus(field: RefObject<HTMLTextAreaElement | null>, disabled: boolean) {
  const wasDisabled = useRef<boolean | null>(null);
  useEffect(() => {
    const node = field.current;
    const nothingFocused = document.activeElement === null || document.activeElement === document.body;
    const takeFocus = wasDisabled.current !== false && !disabled && nothingFocused && window.matchMedia('(pointer: fine)').matches;
    if (node !== null && takeFocus) node.focus();
    wasDisabled.current = disabled;
  }, [disabled, field]);
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
