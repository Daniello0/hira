'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '../auth/session.store';
import { accountDestination, accountPending } from './account-gate';

/** Account-only page. A demo session is not sent to the API. */
export function RequireAccount({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const router = useRouter();
  const destination = accountDestination(status);
  useEffect(() => {
    if (destination !== null) router.replace(destination);
  }, [destination, router]);
  if (accountPending(status)) return <p className="p-6">Loading…</p>;
  if (destination !== null) {
    return (
      <p className="p-6">
        Sign in required. <Link className="text-hira-accent underline" href="/login">Sign in</Link>
      </p>
    );
  }
  return children;
}
