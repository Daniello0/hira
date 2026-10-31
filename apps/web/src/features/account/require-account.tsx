'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SkeletonList } from '../../common/components/feedback';
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
  if (accountPending(status)) return <SkeletonList />;
  if (destination !== null) {
    return (
      <p className="text-sm text-ink-secondary">
        Sign in required. <Link className="text-link underline" href="/login">Sign in</Link>
      </p>
    );
  }
  return children;
}
