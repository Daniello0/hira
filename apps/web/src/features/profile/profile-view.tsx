'use client';

import type { ProfileDto, ProfileSkillDto, UpdateProfileRequest } from '@hira/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../auth/session.store';
import { fetchProfile, fetchProfileSkills, saveProfile } from './profile-api';
import { ProfileForm } from './profile-form';
import { ProfileSkills } from './profile-skills';
import { profileFormValues } from './profile.schema';
import { useSuggestions } from '../suggestions/suggestion.store';

/** Profile form and skill editor. A resume is uploaded from the library. */
export function ProfileView() {
  const token = useSession((state) => state.accessToken);
  const pending = useSuggestions((state) => state.items.length);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [skills, setSkills] = useState<ProfileSkillDto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const reloadSkills = useCallback(async () => {
    if (token === null) return;
    const next = await fetchProfileSkills(token);
    if (next !== null) setSkills(next);
  }, [token]);
  useEffect(() => {
    if (token === null) return;
    void fetchProfile(token).then((next) => { if (next !== null) setProfile(next); });
    void reloadSkills();
  }, [token, reloadSkills, pending]);
  if (token === null) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-hira-muted">
          Upload a resume from the <Link className="text-hira-accent underline" href="/library">library</Link>. Skills found there are offered for confirmation.
        </p>
      </header>
      <ProfileForm values={profile === null ? null : profileFormValues(profile)} notice={notice} onSave={(body) => save(token, body, setProfile, setNotice)} />
      <ProfileSkills token={token} skills={skills} onChange={reloadSkills} />
    </div>
  );
}

async function save(
  token: string,
  body: UpdateProfileRequest,
  setProfile: (profile: ProfileDto) => void,
  setNotice: (notice: string) => void,
): Promise<void> {
  const message = await saveProfile(token, body);
  setNotice(message ?? 'Profile saved');
  if (message !== null) return;
  const next = await fetchProfile(token);
  if (next !== null) setProfile(next);
}
