'use client';

import { SIGN_UP_BANNER } from './chat.constants';

/** Quota copy. Billing is the primary link; registration is beside it. */
export function SignUpLinks({ className = '' }: { className?: string }) {
  return (
    <p className={className}>
      <a className="text-hira-accent underline" href="/billing">{SIGN_UP_BANNER}</a>
      {' · '}
      <a className="underline" href="/register">Sign up</a>
    </p>
  );
}
