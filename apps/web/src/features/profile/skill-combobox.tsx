'use client';

import type { SkillSearchHitDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { TextField } from '../../common/components/text-field';
import { useDebounced } from '../../common/hooks/use-debounced';
import { searchSkills } from './profile-api';

const SKILL_QUERY_MIN = 2;

type SearchState = { kind: 'idle' } | { kind: 'loading' } | { kind: 'hits'; hits: SkillSearchHitDto[] } | { kind: 'failed' };

/** Catalog autocomplete. Typing is debounced; fewer than two characters does not call the API. */
export function SkillCombobox({ onPick }: { onPick: (hit: SkillSearchHitDto) => void }) {
  const [query, setQuery] = useState('');
  const needle = useDebounced(query.trim());
  const [search, setSearch] = useState<SearchState>({ kind: 'idle' });
  useEffect(() => {
    if (needle.length < SKILL_QUERY_MIN) return setSearch({ kind: 'idle' });
    let active = true;
    setSearch({ kind: 'loading' });
    void searchSkills(needle)
      .then((hits) => active && setSearch(hits === null ? { kind: 'failed' } : { kind: 'hits', hits }))
      .catch(() => active && setSearch({ kind: 'failed' }));
    return () => {
      active = false;
    };
  }, [needle]);
  const pick = (hit: SkillSearchHitDto) => {
    onPick(hit);
    setQuery('');
    setSearch({ kind: 'idle' });
  };
  return (
    <div>
      <TextField label="Find a skill" value={query} onChange={(event) => setQuery(event.target.value)} />
      <SearchResult search={search} onPick={pick} />
    </div>
  );
}

function SearchResult({ search, onPick }: { search: SearchState; onPick: (hit: SkillSearchHitDto) => void }) {
  if (search.kind === 'idle') return null;
  if (search.kind === 'loading') return <p className="motion-pulse mt-2 text-sm text-ink-tertiary">Searching…</p>;
  if (search.kind === 'failed') return <p className="mt-2 text-sm text-danger" role="alert">Could not search skills</p>;
  if (search.hits.length === 0) return <p className="mt-2 text-sm text-ink-tertiary">No matches</p>;
  return (
    <ul className="motion-fade mt-2 space-y-0.5">
      {search.hits.map((hit) => (
        <li key={hit.skillId}>
          <button type="button" className="h-row w-full rounded-row px-2 text-left text-sm text-ink transition-colors hover:bg-hover" onClick={() => onPick(hit)}>{hit.canonicalName}</button>
        </li>
      ))}
    </ul>
  );
}
