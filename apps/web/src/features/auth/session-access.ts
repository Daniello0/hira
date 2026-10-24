import { configureAccess } from '../../common/api/authed-fetch';
import { accessForPost, afterRefreshFailure, loadMe, refreshAccess } from './session';
import { useSession } from './session.store';

let inFlight: Promise<string | null> | null = null;

/**
 * Refreshes the access token and the account. Parallel callers share one refresh,
 * so a rotating refresh cookie is never spent twice.
 */
export function renewAccess(): Promise<string | null> {
  if (inFlight === null) {
    inFlight = runRefresh().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/** Bearer token for the next request. A demo tab gets `null`; a dead session signs out. */
export async function accessToken(): Promise<string | null> {
  const session = useSession.getState();
  if (accessForPost(session.status, session.expiresAt, Date.now()) === 'ready') return session.accessToken;
  const renewed = await renewAccess();
  if (renewed !== null) return renewed;
  const current = useSession.getState();
  if (afterRefreshFailure(current.expiresAt, Date.now()) === 'use-current') return current.accessToken;
  current.setAnonymous();
  return null;
}

async function runRefresh(): Promise<string | null> {
  try {
    const grant = await refreshAccess(fetch, Date.now());
    if (grant === null) return null;
    const user = await loadMe(grant.accessToken);
    if (user === null) return null;
    useSession.getState().setAccount(grant, user);
    return grant.accessToken;
  } catch {
    return null;
  }
}

configureAccess({ token: accessToken, renew: renewAccess });
