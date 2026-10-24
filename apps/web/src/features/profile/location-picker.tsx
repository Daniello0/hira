'use client';

import type { LocationDto } from '@hira/contracts';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TextField } from '../../common/components/text-field';
import { useDebounced } from '../../common/hooks/use-debounced';
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
  const write = (next: number[]) => void saveLocations(next, setError, onSaved);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Preferred cities</h2>
      <Chips selected={selected} labels={labels} onRemove={(id) => write(selected.filter((item) => item !== id))} />
      <LocationSearch
        exclude={selected}
        onPick={(location) => {
          setLabels((current) => ({ ...current, [location.id]: location.label }));
          write([...selected, location.id]);
        }}
      />
      {error !== null ? <p role="alert" className="text-sm">{error}</p> : null}
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

function Chips({ selected, labels, onRemove }: { selected: readonly number[]; labels: Record<number, string>; onRemove: (id: number) => void }) {
  if (selected.length === 0) return <p className="text-sm text-hira-muted">No cities yet.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {selected.map((id) => (
        <li key={id} className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-sm">
          {labels[id] ?? `Location #${id}`}
          <button type="button" aria-label={`Remove ${labels[id] ?? 'city'}`} className="text-hira-muted hover:text-hira-text" onClick={() => onRemove(id)}>
            <X size={12} />
          </button>
        </li>
      ))}
    </ul>
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
      {hits !== null && visible.length === 0 ? <p className="mt-2 text-sm text-hira-muted">No matches</p> : null}
      <ul className="mt-2 space-y-1">
        {visible.map((hit) => (
          <li key={hit.id}>
            <button type="button" className="text-sm text-hira-accent" onClick={() => pick(hit)}>{hit.label}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function saveLocations(next: number[], setError: (value: string | null) => void, onSaved: (next: number[]) => void): Promise<void> {
  const message = await saveProfile({ preferredLocations: next }).catch(() => 'Could not reach Hira');
  setError(message === null ? null : `Could not update cities: ${message}`);
  if (message === null) onSaved(next);
}
