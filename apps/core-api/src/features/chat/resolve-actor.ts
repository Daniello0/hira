import { UnauthorizedError } from '../auth/auth.errors';

/** Access token or the demo cookie. A refresh cookie alone is not a caller. */
export type Caller = { kind: 'user'; userId: string } | { kind: 'demo'; demoSessionId: string };

export type CallerHint =
  | { kind: 'user'; userId: string }
  | { kind: 'demo'; sessionId: string }
  | { kind: 'anonymous' };

/** Turns a bearer user or a demo cookie into the chat owner. Does not create a user row. */
export function resolveCaller(hint: CallerHint): Caller {
  if (hint.kind === 'anonymous') throw new UnauthorizedError();
  if (hint.kind === 'user') return { kind: 'user', userId: hint.userId };
  return { kind: 'demo', demoSessionId: hint.sessionId };
}
