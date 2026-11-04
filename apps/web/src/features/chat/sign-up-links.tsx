'use client';

import Link from 'next/link';
import { SIGN_UP_BANNER } from './chat.constants';

/** Quota copy. Billing is the primary link; registration is beside it. Client links: the open chat stays in memory. */
export function SignUpLinks({ className = '' }: { className?: string }) {
  return (
    <p className={className}>
      <Link className="text-link underline transition-colors hover:text-link-hover" href="/settings/billing">{SIGN_UP_BANNER}</Link>
      {' · '}
      <Link className="underline" href="/register">Sign up</Link>
    </p>
  );
}
