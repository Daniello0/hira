import { Button } from '../../common/components/button';
import { TYPE_INSTEAD_LABEL } from './call.constants';
import { speakerLabel, type Caption } from './reduce-call';
import { SPEECH_LANGUAGE_LABELS, SpeechLanguage } from './speech-language';

/** Last phrases of the call with who said them. */
export function CaptionList({ captions }: { captions: readonly Caption[] }) {
  return (
    <ol className="space-y-2 text-sm" aria-live="polite">
      {captions.map((caption) => (
        <li key={caption.id}>
          <span className="font-medium text-hira-muted">{speakerLabel(caption.role)}: </span>
          {caption.content}
        </li>
      ))}
    </ol>
  );
}

/** Voice language for listening and speaking. */
export function LanguageSelect({ value, onChange }: { value: SpeechLanguage; onChange: (value: SpeechLanguage) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm text-hira-muted">
      Voice language
      <select
        className="rounded-md border border-white/15 bg-hira-bg px-2 py-1 text-hira-text"
        value={value}
        onChange={(event) => onChange(event.target.value as SpeechLanguage)}
      >
        {Object.values(SpeechLanguage).map((option) => (
          <option key={option} value={option}>{SPEECH_LANGUAGE_LABELS[option]}</option>
        ))}
      </select>
    </label>
  );
}

/** Typed phrase when the browser cannot listen. */
export function TypeInstead({ typed, onTyped, onType }: { typed: string; onTyped: (value: string) => void; onType: () => void }) {
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onType();
      }}
    >
      <label className="block text-sm text-hira-muted" htmlFor="type-instead">
        {TYPE_INSTEAD_LABEL}
        <textarea
          id="type-instead"
          className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2"
          value={typed}
          onChange={(event) => onTyped(event.target.value)}
        />
      </label>
      <Button type="submit" tone="quiet">
        Send
      </Button>
    </form>
  );
}
