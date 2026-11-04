'use client';

import { useEffect, useRef, useState } from 'react';
import { listen, speechRecognitionAvailable } from '../call/speech';
import { recognitionLang, SpeechLanguage } from '../call/speech-language';
import { appendDictation } from './thread-scroll';

const MIC_DENIED = 'Allow the microphone in your browser to dictate';

/** Speech to text in the composer. Each finished phrase is added to the draft. */
export function useDictation(draft: string, onDraft: (value: string) => void) {
  const [available, setAvailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<{ stop: () => void } | null>(null);
  const latest = useRef({ draft, onDraft });
  latest.current = { draft, onDraft };
  useEffect(() => {
    setAvailable(speechRecognitionAvailable());
    return () => session.current?.stop();
  }, []);
  const toggle = () => {
    if (session.current !== null) {
      session.current.stop();
      session.current = null;
      setListening(false);
      return;
    }
    setError(null);
    let denied = false;
    const started = listen(recognitionLang(SpeechLanguage.Auto, []), {
      onFinal: (text) => latest.current.onDraft(appendDictation(latest.current.draft, text)),
      onEnd: () => {
        session.current = null;
        setListening(false);
      },
      // A refused microphone ends the session without an end event, so the button stayed on "Stop dictation".
      // A start that throws refuses before `listen` returns.
      onDenied: () => {
        denied = true;
        session.current = null;
        setListening(false);
        setError(MIC_DENIED);
      },
    });
    session.current = denied ? null : started;
    setListening(session.current !== null);
  };
  return { available, listening, error, toggle };
}
