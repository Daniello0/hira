'use client';

import type { ProfileDto, ProfileSkillDto, UpdateProfileRequest } from '@hira/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from '../auth/session.store';
import { LocationPicker } from './location-picker';
import { fetchProfile, fetchProfileSkills, saveProfile } from './profile-api';
import { ProfileForm } from './profile-form';
import { ProfileSkills } from './profile-skills';
import { profileFormValues } from './profile.schema';
import { useSuggestions } from '../suggestions/suggestion.store';

/** Profile form, preferred cities, and the skill editor. A resume is uploaded from the library. */
export function ProfileView() {
  const token = useSession((state) => state.accessToken);
  const pending = useSuggestions((state) => state.items.length);
  const [profile, setProfile] = useState<ProfileDto | null>(null);
  const [locations, setLocations] = useState<number[]>([]);
  const [skills, setSkills] = useState<ProfileSkillDto[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const reloadSkills = useCallback(async () => {
    const next = await fetchProfileSkills().catch(() => null);
    if (next !== null) setSkills(next);
  }, []);
  const reloadProfile = useCallback(async () => {
    const next = await fetchProfile().catch(() => null);
    setLoadError(next === null);
    if (next === null) return;
    setProfile(next);
    setLocations(next.preferredLocations);
  }, []);
  useEffect(() => {
    if (token === null) return;
    void reloadProfile();
    void reloadSkills();
  }, [token, reloadProfile, reloadSkills, pending]);
  const formValues = useMemo(() => (profile === null ? null : profileFormValues(profile)), [profile]);
  if (token === null) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-2 text-sm text-hira-muted">
          Upload a resume from the <Link className="text-hira-accent underline" href="/library">library</Link>. Skills found there are offered for confirmation.
        </p>
        {loadError ? <p role="alert" className="mt-2 text-sm">Could not load the profile.</p> : null}
      </header>
      <ProfileForm values={formValues} notice={notice} onSave={(body) => save(body, setNotice, reloadProfile)} />
      <LocationPicker selected={locations} onSaved={setLocations} />
      <ProfileSkills skills={skills} onChange={reloadSkills} />
    </div>
  );
}

async function save(body: UpdateProfileRequest, setNotice: (notice: string) => void, reload: () => Promise<void>): Promise<void> {
  const message = await saveProfile(body).catch(() => 'Could not reach Hira');
  setNotice(message ?? 'Profile saved');
  if (message === null) await reload();
}
