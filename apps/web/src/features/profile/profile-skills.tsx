'use client';

import { SkillLevel, type ProfileSkillDto, type SkillSearchHitDto } from '@hira/contracts';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { addProfileSkill, removeProfileSkill } from './profile-api';
import { SkillCombobox } from './skill-combobox';
import { skillSourceLabel } from './skill-source';

interface ProfileSkillsProps {
  token: string;
  skills: readonly ProfileSkillDto[];
  onChange: () => Promise<void>;
}

/** Manual skills. Resume and dialog skills appear after the user accepts them. */
export function ProfileSkills({ token, skills, onChange }: ProfileSkillsProps) {
  const [picked, setPicked] = useState<SkillSearchHitDto | null>(null);
  const [level, setLevel] = useState<SkillLevel>(SkillLevel.Confident);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Skills</h2>
      <SkillList skills={skills} token={token} onChange={onChange} />
      <SkillCombobox token={token} onPick={setPicked} />
      <LevelField level={level} onChange={setLevel} />
      {picked !== null ? <p className="text-sm">Selected: {picked.canonicalName}</p> : null}
      {error !== null ? <p role="alert">{error}</p> : null}
      <Button type="button" disabled={picked === null} onClick={() => void add(token, picked, level, setError, setPicked, onChange)}>Add skill</Button>
    </section>
  );
}

function SkillList({ skills, token, onChange }: ProfileSkillsProps) {
  if (skills.length === 0) return <p className="text-sm text-hira-muted">No skills on your profile yet.</p>;
  return (
    <ul className="space-y-2">
      {skills.map((skill) => (
        <li key={skill.skillId} className="flex items-center justify-between gap-3 text-sm">
          <span>{skill.canonicalName} · {skill.level} · {skillSourceLabel(skill.source)}</span>
          <button type="button" className="text-hira-muted" onClick={() => void remove(token, skill.skillId, onChange)}>Remove</button>
        </li>
      ))}
    </ul>
  );
}

function LevelField({ level, onChange }: { level: SkillLevel; onChange: (level: SkillLevel) => void }) {
  return (
    <label className="block text-sm text-hira-muted">
      Level
      <select className="mt-1 w-full rounded-md border border-white/15 bg-hira-bg px-3 py-2 text-hira-text" value={level} onChange={(event) => onChange(event.target.value as SkillLevel)}>
        {Object.values(SkillLevel).map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </label>
  );
}

async function add(
  token: string,
  picked: SkillSearchHitDto | null,
  level: SkillLevel,
  setError: (value: string | null) => void,
  setPicked: (value: SkillSearchHitDto | null) => void,
  onChange: () => Promise<void>,
): Promise<void> {
  if (picked === null) return;
  const message = await addProfileSkill(token, { skillId: picked.skillId, level });
  setError(message);
  if (message !== null) return;
  setPicked(null);
  await onChange();
}

async function remove(token: string, skillId: number, onChange: () => Promise<void>): Promise<void> {
  if (await removeProfileSkill(token, skillId)) await onChange();
}
