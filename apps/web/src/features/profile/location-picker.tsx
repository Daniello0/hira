'use client';

import type { LocationDto } from '@hira/contracts';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { AlertText, MutedText } from '../../common/components/feedback';
import { SectionHeading } from '../../common/components/page-frame';
import { TextField } from '../../common/components/text-field';
import { useDebounced } from '../../common/hooks/use-debounced';
import { useLeaving } from '../../common/hooks/use-leaving';
import { saveProfile, searchLocations } from './profile-api';

interface LocationPickerProps {
  selected: readonly number[];
  onSaved: (next: number[]) => void;
}

/** Preferred cities. Each add or remove is saved at once with `PUT /profile`. */
export function LocationPicker({ selected, onSaved }: LocationPickerProps) {
  const [labels, setLabels] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  useKnownLabels(selected, labels, setLabels);
  // A city on its way out still counts as selected until its animation ends, but must not be saved back.
  const removing = useRef(new Set<number>());
  const kept = () => selected.filter((item) => !removing.current.has(item));
  const removeCity = (id: number, leave: (change: () => void) => void) => {
    removing.current.add(id);
    const apply = (change: () => void) => leave(() => {
      removing.current.delete(id);
      change();
    });
    void saveLocations(kept(), setError, onSaved, apply).then((saved) => {
      if (!saved) removing.current.delete(id);
    });
  };
  return (
    <section className="space-y-3">
      <SectionHeading>Preferred cities</SectionHeading>
      <Chips selected={selected} labels={labels} onRemove={removeCity} />
      <LocationSearch
        exclude={selected}
        onPick={(location) => {
          setLabels((current) => ({ ...current, [location.id]: location.label }));
          void saveLocations([...kept(), location.id], setError, onSaved);
        }}
      />
      {error !== null ? <AlertText>{error}</AlertText> : null}
    </section>
  );
}

/** Labels for ids saved earlier. The first page of `/locations` covers the usual cities. */
function useKnownLabels(selected: readonly number[], labels: Record<number, string>, setLabels: (next: Record<number, string>) => void): void {
  const missing = selected.some((id) => labels[id] === undefined);
  useEffect(() => {
    if (!missing) return;
    void searchLocations('')
      .then((rows) => setLabels({ ...Object.fromEntries((rows ?? []).map((row) => [row.id, row.label])), ...labels }))
      .catch(() => undefined);
    // Only re-run when an unknown id appears; `labels` is merged, not a trigger.
  }, [missing]);
}

function Chips({ selected, labels, onRemove }: { selected: readonly number[]; labels: Record<number, string>; onRemove: (id: number, leave: (change: () => void) => void) => void }) {
  if (selected.length === 0) return <MutedText>No cities yet.</MutedText>;
  return (
    <ul className="flex flex-wrap gap-2">
      {selected.map((id) => <Chip key={id} label={labels[id]} id={id} onRemove={onRemove} />)}
    </ul>
  );
}

function Chip({ id, label, onRemove }: { id: number; label: string | undefined; onRemove: (id: number, leave: (change: () => void) => void) => void }) {
  const { leaving, leave } = useLeaving();
  return (
    <li data-leaving={leaving} className="motion-row motion-enter flex items-center gap-1 rounded-full bg-hover px-3 py-1 text-sm">
      {label ?? `Location #${id}`}
      <button type="button" aria-label={`Remove ${label ?? 'city'}`} className="text-ink-tertiary transition-colors hover:text-ink" onClick={() => onRemove(id, leave)}>
        <X className="size-icon-2xs" />
      </button>
    </li>
  );
}

function LocationSearch({ exclude, onPick }: { exclude: readonly number[]; onPick: (location: LocationDto) => void }) {
  const [query, setQuery] = useState('');
  const needle = useDebounced(query.trim());
  const [hits, setHits] = useState<LocationDto[] | null>(null);
  useEffect(() => {
    if (needle.length === 0) return setHits(null);
    let active = true;
    void searchLocations(needle).then((rows) => active && setHits(rows ?? [])).catch(() => active && setHits([]));
    return () => {
      active = false;
    };
  }, [needle]);
  const visible = (hits ?? []).filter((hit) => !exclude.includes(hit.id));
  const pick = (location: LocationDto) => {
    onPick(location);
    setQuery('');
    setHits(null);
  };
  return (
    <div>
      <TextField label="Add a city" value={query} onChange={(event) => setQuery(event.target.value)} />
      {hits !== null && visible.length === 0 ? <p className="mt-2 text-sm text-ink-tertiary">No matches</p> : null}
      <ul className="motion-fade mt-2 space-y-0.5">
        {visible.map((hit) => (
          <li key={hit.id}>
            <button type="button" className="h-row w-full rounded-row px-2 text-left text-sm text-ink transition-colors hover:bg-hover" onClick={() => pick(hit)}>{hit.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function saveLocations(next: number[], setError: (value: string | null) => void, onSaved: (next: number[]) => void, apply: (change: () => void) => void = (change) => change()): Promise<boolean> {
  const message = await saveProfile({ preferredLocations: next }).catch(() => 'Could not reach Hira');
  setError(message === null ? null : `Could not update cities: ${message}`);
  if (message === null) apply(() => onSaved(next));
  return message === null;
}
