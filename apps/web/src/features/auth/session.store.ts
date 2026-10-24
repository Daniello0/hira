import type { CurrentUserDto } from '@hira/contracts';
import { create } from 'zustand';
import type { AccessGrant } from './session';
import { SessionStatus } from './session-status';

interface SessionState {
  status: SessionStatus;
  accessToken: string | null;
  expiresAt: number | null;
  user: CurrentUserDto | null;
  setAccount: (grant: AccessGrant, user: CurrentUserDto) => void;
  setAnonymous: () => void;
  patchUser: (user: CurrentUserDto) => void;
}

/** Access token for this tab. The refresh cookie stays httpOnly. */
export const useSession = create<SessionState>((set) => ({
  status: SessionStatus.Unknown,
  accessToken: null,
  expiresAt: null,
  user: null,
  setAccount: (grant, user) =>
    set({ status: SessionStatus.Account, accessToken: grant.accessToken, expiresAt: grant.expiresAt, user }),
  setAnonymous: () => set({ status: SessionStatus.Anonymous, accessToken: null, expiresAt: null, user: null }),
  patchUser: (user) => set({ user }),
}));
