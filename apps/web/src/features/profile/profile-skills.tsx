'use client';

import { SkillLevel, type ProfileSkillDto, type SkillSearchHitDto } from '@hira/contracts';
import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../common/components/button';
import { AlertText, MutedText } from '../../common/components/feedback';
import { IconButton } from '../../common/components/icon-button';
import { SectionHeading } from '../../common/components/page-frame';
import { Select } from '../../common/components/select';
import { skillLevelLabel } from '../../common/utils/enum-labels';
import { addProfileSkill, removeProfileSkill } from './profile-api';
import { SkillCombobox } from './skill-combobox';
import { skillSourceLabel } from './skill-source';

interface ProfileSkillsProps {
  skills: readonly ProfileSkillDto[];
  onChange: () => Promise<void>;
}

/** Manual skills. Resume and dialog skills appear after the user accepts them. */
export function ProfileSkills({ skills, onChange }: ProfileSkillsProps) {
  const [picked, setPicked] = useState<SkillSearchHitDto | null>(null);
  const [level, setLevel] = useState<SkillLevel>(SkillLevel.Confident);
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="space-y-3">
      <SectionHeading>Skills</SectionHeading>
      <SkillList skills={skills} onChange={onChange} onError={setError} />
      <SkillCombobox onPick={setPicked} />
      <LevelField level={level} onChange={setLevel} />
      {picked !== null ? <p className="motion-fade text-sm">Selected: {picked.canonicalName}</p> : null}
      {error !== null ? <AlertText>{error}</AlertText> : null}
      <Button disabled={picked === null} onClick={() => void add(picked, level, setError, setPicked, onChange)}>Add skill</Button>
    </section>
  );
}

function SkillList({ skills, onChange, onError }: ProfileSkillsProps & { onError: (value: string | null) => void }) {
  if (skills.length === 0) return <MutedText>No skills on your profile yet.</MutedText>;
  return (
    <ul className="space-y-2">
      {skills.map((skill) => (
        <li key={skill.skillId} className="motion-enter flex items-center justify-between gap-3 text-sm">
          <span className="min-w-0">{skill.canonicalName} · {skillLevelLabel(skill.level)} · {skillSourceLabel(skill.source)}</span>
          <IconButton label={`Remove ${skill.canonicalName}`} shape="action" onClick={() => void remove(skill, onChange, onError)}><X className="size-icon-sm" aria-hidden="true" /></IconButton>
        </li>
      ))}
    </ul>
  );
}

function LevelField({ level, onChange }: { level: SkillLevel; onChange: (level: SkillLevel) => void }) {
  return <Select label="Level" value={level} options={Object.values(SkillLevel).map((item) => ({ value: item, label: skillLevelLabel(item) }))} onChange={(next) => onChange(next as SkillLevel)} />;
}

async function add(
  picked: SkillSearchHitDto | null,
  level: SkillLevel,
  setError: (value: string | null) => void,
  setPicked: (value: SkillSearchHitDto | null) => void,
  onChange: () => Promise<void>,
): Promise<void> {
  if (picked === null) return;
  const message = await addProfileSkill({ skillId: picked.skillId, level }).catch(() => 'Could not reach Hira');
  setError(message);
  if (message !== null) return;
  setPicked(null);
  await onChange();
}

async function remove(skill: ProfileSkillDto, onChange: () => Promise<void>, onError: (value: string | null) => void): Promise<void> {
  const ok = await removeProfileSkill(skill.skillId).catch(() => false);
  onError(ok ? null : `Could not remove ${skill.canonicalName}`);
  if (ok) await onChange();
}
