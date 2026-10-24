import type { KeyboardEvent } from 'react';
import { Button } from '../../common/components/button';
import { SignUpLinks } from './sign-up-links';

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

/** Composer. Enter sends, Shift+Enter adds a line. It stays disabled until the stream is idle. */
export function MessageInput(props: MessageInputProps) {
  const { draft, disabled, archived, onDraft, onSend } = props;
  return (
    <form className="border-t border-white/10 p-4" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <StatusLine banner={props.banner} notice={props.notice} account={props.account} />
      {archived ? <p className="mb-2 text-sm text-hira-muted">This chat is archived. Restore it from the sidebar to keep writing.</p> : null}
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="message">Message</label>
        <textarea
          id="message"
          value={draft}
          disabled={disabled}
          rows={3}
          className="min-h-16 flex-1 rounded-md border border-white/15 bg-hira-bg px-3 py-2"
          placeholder={archived ? 'Archived chat' : 'Message Hira'}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => submitOnEnter(event, onSend)}
        />
        <Button type="submit" disabled={disabled}>Send</Button>
      </div>
      <Switches {...props} />
    </form>
  );
}

function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>, onSend: () => void): void {
  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
  event.preventDefault();
  onSend();
}

function Switches({ account, useMemory, includeForeignRemote, onUseMemory, onIncludeForeignRemote }: MessageInputProps) {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-hira-muted">
      {account ? (
        <label className="flex items-center gap-2" title="Let Hira read your saved memory for this message">
          <input type="checkbox" checked={useMemory} onChange={(event) => onUseMemory(event.target.checked)} />
          Use memory
        </label>
      ) : null}
      <label className="flex items-center gap-2" title="Remote vacancies from employers abroad">
        <input type="checkbox" checked={includeForeignRemote} onChange={(event) => onIncludeForeignRemote(event.target.checked)} />
        Show foreign remote
      </label>
    </div>
  );
}

function StatusLine({ banner, notice, account }: { banner: string | null; notice: string | null; account: boolean }) {
  return (
    <div className="mb-2 text-sm">
      {banner !== null && !account ? <SignUpLinks /> : null}
      {banner !== null && account ? <p>Search quota exceeded</p> : null}
      {notice !== null ? <p role="alert">{notice}</p> : null}
    </div>
  );
}
