import { accessToken } from './session-access';
import { loadMe } from './session';
import { useSession } from './session.store';
import { SessionStatus } from './session-status';

/** Re-reads the account, so the plan and the query counter match the server. */
export async function refreshAccount(): Promise<void> {
  if (useSession.getState().status !== SessionStatus.Account) return;
  const token = await accessToken();
  if (token === null) return;
  const user = await loadMe(token).catch(() => null);
  if (user !== null) useSession.getState().patchUser(user);
}
