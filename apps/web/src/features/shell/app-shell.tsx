'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Drawer } from '../../common/components/drawer';
import { renewAccess } from '../auth/session-access';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { fetchFavorites } from '../favorites/favorites-api';
import { useSavedVacancies } from '../favorites/saved-vacancies.store';
import { ResumeSuggestionsModal } from '../suggestions/resume-suggestions-modal';
import { SuggestionModal } from '../suggestions/suggestion-modal';
import { useSuggestions } from '../suggestions/suggestion.store';
import { ChatSidebar, refreshChatList } from '../chat/chat-sidebar';
import { VacancyDetailDrawer } from '../vacancy/vacancy-detail-drawer';
import { useShell } from './shell.store';

/** Dark shell: sidebar, Call, and the page. */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  const user = useSession((state) => state.user);
  useBootstrap();
  useAccountData(status, token);
  const account = status === SessionStatus.Account && token !== null;
  return (
    <div className="min-h-screen bg-hira-bg text-hira-text">
      {account ? <SuggestionModal /> : null}
      {account ? <ResumeSuggestionsModal /> : null}
      <VacancyDetailDrawer />
      <MobileBar />
      <div className="md:grid md:min-h-screen md:grid-cols-[16rem_1fr]">
        <aside className="hidden border-r border-white/10 bg-hira-panel/30 p-4 md:block">
          <ChatSidebar user={user} />
        </aside>
        <SidebarDrawer user={user} />
        <div className="min-h-screen">{children}</div>
      </div>
    </div>
  );
}

function useBootstrap(): void {
  useEffect(() => {
    if (useSession.getState().status !== SessionStatus.Unknown) return;
    void renewAccess().then((token) => {
      if (token === null) useSession.getState().setAnonymous();
    });
  }, []);
}

function useAccountData(status: SessionStatus, token: string | null): void {
  useEffect(() => {
    if (status === SessionStatus.Unknown) return;
    void refreshChatList();
  }, [status, token]);
  useEffect(() => {
    if (status === SessionStatus.Anonymous) {
      useSuggestions.getState().clear();
      useSavedVacancies.getState().clear();
      return;
    }
    if (status !== SessionStatus.Account || token === null) return;
    void useSuggestions.getState().reload();
    void fetchFavorites().then((rows) => {
      if (rows !== null) useSavedVacancies.getState().setAll(rows);
    });
  }, [status, token]);
}

function MobileBar() {
  const setSidebar = useShell((state) => state.setSidebar);
  return (
    <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 md:hidden">
      <button type="button" onClick={() => setSidebar(true)}>
        Menu
      </button>
      <span className="font-medium">Hira</span>
    </header>
  );
}

function SidebarDrawer({ user }: { user: ReturnType<typeof useSession.getState>['user'] }) {
  const open = useShell((state) => state.sidebarOpen);
  const setSidebar = useShell((state) => state.setSidebar);
  const pathname = usePathname();
  useEffect(() => {
    setSidebar(false);
  }, [pathname, setSidebar]);
  return (
    <Drawer open={open} label="Chats" onClose={() => setSidebar(false)}>
      <ChatSidebar user={user} />
    </Drawer>
  );
}
