'use client';

import { Check } from 'lucide-react';
import { PageHeading, SectionHeading } from '../../common/components/page-frame';
import { RowCard, SettingsRow } from '../../common/components/card';
import { ThemeMode } from '../theme/theme-mode';
import { useTheme } from '../theme/theme.store';

const MODES = [
  { mode: ThemeMode.System, label: 'System' },
  { mode: ThemeMode.Light, label: 'Light' },
  { mode: ThemeMode.Dark, label: 'Dark' },
] as const;

/** Theme choice: three previews drawn with the theme tokens themselves. */
export function AppearanceSection() {
  const current = useTheme((state) => state.mode);
  const setMode = useTheme((state) => state.setMode);
  return (
    <>
      <PageHeading title="Appearance" />
      <section className="space-y-3">
        <SectionHeading>Visual style</SectionHeading>
        <RowCard>
          <SettingsRow label="Mode">
            <div role="radiogroup" aria-label="Mode" className="flex gap-2">
              {MODES.map(({ mode, label }) => <ModeOption key={mode} mode={mode} label={label} selected={current === mode} onSelect={() => setMode(mode)} />)}
            </div>
          </SettingsRow>
        </RowCard>
      </section>
    </>
  );
}

function ModeOption({ mode, label, selected, onSelect }: { mode: ThemeMode; label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={label} className="group text-center text-xs text-ink-secondary" onClick={onSelect}>
      <span className={`relative flex h-preview-h w-preview-w overflow-hidden rounded-row border-2 transition-colors ${selected ? 'border-accent-focus' : 'border-line group-hover:border-line-heavy'}`}>
        {mode === ThemeMode.System ? (
          <>
            <Preview theme="light" />
            <Preview theme="dark" />
          </>
        ) : (
          <Preview theme={mode === ThemeMode.Light ? 'light' : 'dark'} />
        )}
        {selected ? <span className="motion-fade absolute right-1 bottom-1 flex size-icon-sm items-center justify-center rounded-full bg-accent text-on-accent"><Check className="size-icon-2xs" aria-hidden="true" /></span> : null}
      </span>
      <span className="mt-1 block">{label}</span>
    </button>
  );
}

function Preview({ theme }: { theme: 'light' | 'dark' }) {
  return (
    <span data-theme={theme} className="flex min-w-0 flex-1 flex-col gap-1 bg-surface p-1.5">
      <span className="h-1 w-3/4 rounded-full bg-ink-tertiary" />
      <span className="h-1 w-1/2 self-end rounded-full bg-accent" />
      <span className="mt-auto h-2 rounded-full bg-surface-control" />
    </span>
  );
}
