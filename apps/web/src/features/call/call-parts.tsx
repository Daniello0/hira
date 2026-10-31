import { AudioLines } from 'lucide-react';
import { Button } from '../../common/components/button';
import { Select } from '../../common/components/select';
import { TextArea } from '../../common/components/text-field';
import { TYPE_INSTEAD_LABEL } from './call.constants';
import { CallPhase } from './call-phase';
import { speakerLabel, type Caption } from './reduce-call';
import { SPEECH_LANGUAGE_LABELS, SpeechLanguage } from './speech-language';

/** Big round mark of the call and what Hira is doing. It pulses while the call is live. */
export function PhaseIndicator({ phase, label }: { phase: CallPhase; label: string }) {
  const live = phase !== CallPhase.Idle;
  return (
    <div className="flex flex-col items-center gap-3 py-6">
      <span className={`flex size-composer items-center justify-center rounded-full bg-accent text-on-accent ${live ? 'motion-pulse' : ''}`}>
        <AudioLines size={24} aria-hidden="true" />
      </span>
      <p key={label} className="motion-fade text-lg">{label}</p>
    </div>
  );
}

/** Last phrases of the call with who said them. */
export function CaptionList({ captions }: { captions: readonly Caption[] }) {
  return (
    <ol className="space-y-2 text-base" aria-live="polite">
      {captions.map((caption) => (
        <li key={caption.id} className="motion-enter">
          <span className="font-medium text-ink-tertiary">{speakerLabel(caption.role)}: </span>
          {caption.content}
        </li>
      ))}
    </ol>
  );
}

/** Voice language for listening and speaking. */
export function LanguageSelect({ value, onChange }: { value: SpeechLanguage; onChange: (value: SpeechLanguage) => void }) {
  const options = Object.values(SpeechLanguage).map((option) => ({ value: option, label: SPEECH_LANGUAGE_LABELS[option] }));
  return <Select ariaLabel="Voice language" value={value} options={options} onChange={(next) => onChange(next as SpeechLanguage)} />;
}

/** Typed phrase when the browser cannot listen. */
export function TypeInstead({ typed, onTyped, onType }: { typed: string; onTyped: (value: string) => void; onType: () => void }) {
  return (
    <form
      className="motion-enter space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onType();
      }}
    >
      <TextArea label={TYPE_INSTEAD_LABEL} value={typed} onChange={(event) => onTyped(event.target.value)} />
      <Button type="submit" variant="secondary">Send</Button>
    </form>
  );
}
