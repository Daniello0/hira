import type { useRouter } from 'next/navigation';
import { authedFetch } from '../../common/api/authed-fetch';
import { notifyOtherTabs } from '../../common/data/data-version.store';
import { useSession } from './session.store';

/** Ends the session on the server and in this tab, even when the request fails. */
export async function signOut(router: ReturnType<typeof useRouter>): Promise<void> {
  try {
    await authedFetch('/api/v1/auth/logout', { method: 'POST' });
  } finally {
    useSession.getState().setAnonymous();
    notifyOtherTabs('session');
    router.push('/login');
  }
}
