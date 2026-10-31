'use client';

import { useRouter } from 'next/navigation';
import { Button } from '../../common/components/button';
import { RowCard, SettingsRow } from '../../common/components/card';
import { PageHeading } from '../../common/components/page-frame';
import { useSession } from '../auth/session.store';
import { signOut } from '../auth/sign-out';

/** Email, name, today's search count, and signing out. */
export function AccountSection() {
  const user = useSession((state) => state.user);
  const router = useRouter();
  if (user === null) return null;
  return (
    <>
      <PageHeading title="Account" />
      <RowCard>
        <SettingsRow label="Email"><span className="truncate text-sm text-ink-secondary">{user.email}</span></SettingsRow>
        <SettingsRow label="Name"><span className="truncate text-sm text-ink-secondary">{user.displayName ?? 'Not set'}</span></SettingsRow>
        {user.searchQuota !== undefined ? (
          <SettingsRow label="Search queries today"><span className="text-sm text-ink-secondary">{user.searchQuota.used}/{user.searchQuota.limit}</span></SettingsRow>
        ) : null}
        <SettingsRow label="Log out of this browser">
          <Button variant="secondary" onClick={() => void signOut(router)}>Log out</Button>
        </SettingsRow>
      </RowCard>
    </>
  );
}
