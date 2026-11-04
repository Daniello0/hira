'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { startDataSync, useDataVersion } from '../../common/data/data-version.store';
import { renewAccess } from './session-access';

/**
 * Sign-in and registration live outside the app shell, so nothing told them about a sign-in made in another tab:
 * that tab kept asking for the password. They now follow it, and an account that is already signed in lands in the app.
 */
export function useFollowSignIn(): void {
  const router = useRouter();
  const session = useDataVersion('session');
  useEffect(() => startDataSync(), []);
  useEffect(() => {
    let active = true;
    void renewAccess().then((token) => {
      if (active && token !== null) router.replace('/chat');
    });
    return () => {
      active = false;
    };
  }, [session, router]);
}
