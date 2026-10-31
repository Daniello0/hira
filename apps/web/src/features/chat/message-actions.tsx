'use client';

import { Check, Copy, Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '../../common/components/icon-button';
import { silence, speak } from '../call/speech';
import { SpeechLanguage, synthesisLang } from '../call/speech-language';

const COPIED_MS = 2_000;
const ICON_SIZE = 18;

/** Puts the message on the clipboard and confirms with a check mark. */
export function CopyAction({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    });
  };
  return (
    <IconButton label={copied ? 'Copied' : 'Copy'} shape="action" onClick={copy}>
      {copied ? <Check size={ICON_SIZE} aria-hidden="true" className="motion-fade" /> : <Copy size={ICON_SIZE} aria-hidden="true" />}
    </IconButton>
  );
}

/** Reads the answer aloud with the browser voice; pressing again stops it. */
export function ReadAloudAction({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(false);
  const active = useRef(false);
  useEffect(() => {
    setAvailable('speechSynthesis' in window);
    return () => {
      if (active.current) silence();
    };
  }, []);
  if (!available) return null;
  const toggle = () => {
    if (speaking) {
      silence();
      active.current = false;
      return setSpeaking(false);
    }
    active.current = true;
    setSpeaking(true);
    speak(text, synthesisLang(SpeechLanguage.Auto, text), () => {
      active.current = false;
      setSpeaking(false);
    });
  };
  return (
    <IconButton label={speaking ? 'Stop reading' : 'Read aloud'} shape="action" tone={speaking ? 'active' : 'muted'} onClick={toggle}>
      {speaking ? <Square size={ICON_SIZE} aria-hidden="true" /> : <Volume2 size={ICON_SIZE} aria-hidden="true" />}
    </IconButton>
  );
}
