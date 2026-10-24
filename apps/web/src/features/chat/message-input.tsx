import { Button } from '../../common/components/button';
import { SignUpLinks } from './sign-up-links';

interface MessageInputProps {
  draft: string;
  disabled: boolean;
  banner: string | null;
  notice: string | null;
  account: boolean;
  onDraft: (value: string) => void;
  onSend: () => void;
}

/** Composer. It stays disabled until the stream is idle. */
export function MessageInput({ draft, disabled, banner, notice, account, onDraft, onSend }: MessageInputProps) {
  return (
    <form className="border-t border-white/10 p-4" onSubmit={(event) => { event.preventDefault(); onSend(); }}>
      <StatusLine banner={banner} notice={notice} account={account} />
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="message">Message</label>
        <textarea
          id="message"
          value={draft}
          disabled={disabled}
          rows={3}
          className="min-h-16 flex-1 rounded-md border border-white/15 bg-hira-bg px-3 py-2"
          placeholder="Message Hira"
          onChange={(event) => onDraft(event.target.value)}
        />
        <Button type="submit" disabled={disabled}>Send</Button>
      </div>
    </form>
  );
}

function StatusLine({ banner, notice, account }: { banner: string | null; notice: string | null; account: boolean }) {
  return (
    <div className="mb-2 text-sm">
      {banner !== null && !account ? <SignUpLinks /> : null}
      {banner !== null && account ? <p>Search quota exceeded</p> : null}
      {notice !== null ? <p>{notice}</p> : null}
    </div>
  );
}
