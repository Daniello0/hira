import { configureAccess } from '../../common/api/authed-fetch';
import { BOOTSTRAP_RETRY_MS, REFRESH_LOCK_NAME } from './auth.constants';
import { accessForPost, afterRefreshFailure, loadMe, refreshAccess } from './session';
import { useSession } from './session.store';
import { SessionStatus } from './session-status';

/** `unreachable` is a network failure or a 5xx: the session may still be fine. */
type RefreshOutcome = { kind: 'granted'; token: string } | { kind: 'rejected' } | { kind: 'unreachable' };

let inFlight: Promise<RefreshOutcome> | null = null;

/** One refresh at a time in this tab, and across tabs where the browser has locks. */
function refreshOnce(): Promise<RefreshOutcome> {
  if (inFlight === null) {
    inFlight = underTabLock(runRefresh).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * Refreshes the access token and the account. Parallel callers share one refresh,
 * so a rotating refresh cookie is never spent twice.
 */
export async function renewAccess(): Promise<string | null> {
  const outcome = await refreshOnce();
  return outcome.kind === 'granted' ? outcome.token : null;
}

/** Bearer token for the next request. A demo tab gets `null`; only a rejected session signs out. */
export async function accessToken(): Promise<string | null> {
  const session = useSession.getState();
  if (accessForPost(session.status, session.expiresAt, Date.now()) === 'ready') return session.accessToken;
  const outcome = await refreshOnce();
  if (outcome.kind === 'granted') return outcome.token;
  const current = useSession.getState();
  if (outcome.kind === 'unreachable' || afterRefreshFailure(current.expiresAt, Date.now()) === 'use-current') return current.accessToken;
  current.setAnonymous();
  return null;
}

/** First refresh of a tab. An unreachable API keeps the status unknown and tries again. */
export async function bootstrapSession(): Promise<void> {
  const outcome = await refreshOnce();
  if (useSession.getState().status !== SessionStatus.Unknown) return;
  if (outcome.kind === 'rejected') useSession.getState().setAnonymous();
  if (outcome.kind === 'unreachable') setTimeout(() => void bootstrapSession(), BOOTSTRAP_RETRY_MS);
}

/** Another tab signed in or out: this tab follows the refresh cookie. An unreachable API changes nothing. */
export async function syncSession(): Promise<void> {
  const outcome = await refreshOnce();
  if (outcome.kind === 'rejected') useSession.getState().setAnonymous();
}

function underTabLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator === 'undefined' || navigator.locks === undefined) return run();
  return navigator.locks.request(REFRESH_LOCK_NAME, run) as Promise<T>;
}

async function runRefresh(): Promise<RefreshOutcome> {
  try {
    const grant = await refreshAccess(fetch, Date.now());
    if (grant === null) return { kind: 'rejected' };
    const user = await loadMe(grant.accessToken);
    if (user === null) return { kind: 'unreachable' };
    useSession.getState().setAccount(grant, user);
    return { kind: 'granted', token: grant.accessToken };
  } catch {
    return { kind: 'unreachable' };
  }
}

configureAccess({ token: accessToken, renew: renewAccess });
