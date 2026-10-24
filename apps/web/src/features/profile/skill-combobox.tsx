'use client';

import type { SkillSearchHitDto } from '@hira/contracts';
import { useEffect, useState } from 'react';
import { TextField } from '../../common/components/text-field';
import { searchSkills } from './profile-api';

const SKILL_QUERY_MIN = 2;

interface SkillComboboxProps {
  token: string;
  onPick: (hit: SkillSearchHitDto) => void;
}

/** Catalog autocomplete. Fewer than two characters does not call the API. */
export function SkillCombobox({ token, onPick }: SkillComboboxProps) {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SkillSearchHitDto[]>([]);
  useEffect(() => {
    const needle = query.trim();
    if (needle.length < SKILL_QUERY_MIN) {
      setHits([]);
      return;
    }
    let active = true;
    void searchSkills(token, needle).then((next) => {
      if (active) setHits(next);
    });
    return () => {
      active = false;
    };
  }, [query, token]);
  return (
    <div>
      <TextField label="Find a skill" value={query} onChange={(event) => setQuery(event.target.value)} />
      <HitList hits={hits} onPick={onPick} />
    </div>
  );
}

function HitList({ hits, onPick }: { hits: readonly SkillSearchHitDto[]; onPick: (hit: SkillSearchHitDto) => void }) {
  if (hits.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {hits.map((hit) => (
        <li key={hit.skillId}>
          <button type="button" className="text-sm text-hira-accent" onClick={() => onPick(hit)}>{hit.canonicalName}</button>
        </li>
      ))}
    </ul>
  );
}
