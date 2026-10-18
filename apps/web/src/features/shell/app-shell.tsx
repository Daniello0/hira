'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Drawer } from '../../common/components/drawer';
import { refreshAccess, loadMe } from '../auth/session';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { ChatSidebar, refreshChatList } from '../chat/chat-sidebar';
import { useShell } from './shell.store';

/** Dark shell: sidebar, Call, and the page. */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  const setAccount = useSession((state) => state.setAccount);
  const setAnonymous = useSession((state) => state.setAnonymous);
  useEffect(() => {
    if (useSession.getState().status !== SessionStatus.Unknown) return;
    void bootstrap(setAccount, setAnonymous);
  }, [setAccount, setAnonymous]);
  useEffect(() => {
    if (status === SessionStatus.Unknown) return;
    void refreshChatList(token);
  }, [status, token]);
  return (
    <div className="min-h-screen bg-hira-bg text-hira-text">
      <MobileBar />
      <div className="md:grid md:min-h-screen md:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-white/10 bg-hira-panel/30 p-4 md:block">
          <ChatSidebar token={token} user={user} />
        </aside>
        <SidebarDrawer token={token} user={user} />
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}

async function bootstrap(setAccount: ReturnType<typeof useSession.getState>['setAccount'], setAnonymous: () => void): Promise<void> {
  const grant = await refreshAccess(fetch, Date.now());
  if (grant === null) {
    setAnonymous();
    return;
  }
  const user = await loadMe(grant.accessToken);
  if (user === null) setAnonymous();
  else setAccount(grant, user);
}

function MobileBar() {
  const setSidebar = useShell((state) => state.setSidebar);
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
      <button type="button" onClick={() => setSidebar(true)}>Menu</button>
      <span className="font-medium">Hira</span>
    </header>
  );
}

function SidebarDrawer({ token, user }: { token: string | null; user: ReturnType<typeof useSession.getState>['user'] }) {
  const open = useShell((state) => state.sidebarOpen);
  const setSidebar = useShell((state) => state.setSidebar);
  return (
    <Drawer open={open} label="Chats" onClose={() => setSidebar(false)}>
      <ChatSidebar token={token} user={user} />
    </Drawer>
  );
}
