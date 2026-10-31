'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Sheet } from '../../common/components/sheet';
import { DESKTOP_QUERY, useMediaQuery } from '../../common/hooks/use-media-query';
import { renewAccess } from '../auth/session-access';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { refreshChatList } from '../chat/chat-sidebar';
import { fetchFavorites } from '../favorites/favorites-api';
import { useSavedVacancies } from '../favorites/saved-vacancies.store';
import { ResumeSuggestionsModal } from '../suggestions/resume-suggestions-modal';
import { SuggestionModal } from '../suggestions/suggestion-modal';
import { useSuggestions } from '../suggestions/suggestion.store';
import { VacancyDetailDrawer } from '../vacancy/vacancy-detail-drawer';
import { SearchChatsDialog } from './search-chats-dialog';
import { useShell } from './shell.store';
import { DesktopSidebar, SidebarContent } from './sidebar';

/** App frame: sidebar column or sheet, the page, and the overlays every page shares. */
export function AppShell({ children }: { children: ReactNode }) {
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  useBootstrap();
  useAccountData(status, token);
  useLayoutMemory();
  const account = status === SessionStatus.Account && token !== null;
  return (
    <div className="flex h-dvh overflow-hidden bg-surface pt-safe-top text-ink">
      {account ? <SuggestionModal /> : null}
      {account ? <ResumeSuggestionsModal /> : null}
      <VacancyDetailDrawer />
      <SearchChatsDialog />
      <DesktopSidebar />
      <SidebarSheet />
      <main className="page-transition relative min-w-0 flex-1 pb-safe-bottom">{children}</main>
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

/** Restores the saved layout and opens chat search on Cmd or Ctrl+K. */
function useLayoutMemory(): void {
  useEffect(() => {
    useShell.getState().load();
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      useShell.getState().setSearch(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function SidebarSheet() {
  const open = useShell((state) => state.sidebarOpen);
  const setSidebar = useShell((state) => state.setSidebar);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const pathname = usePathname();
  useEffect(() => {
    setSidebar(false);
  }, [pathname, setSidebar]);
  return (
    <Sheet open={open && !desktop} label="Sidebar" onClose={() => setSidebar(false)}>
      <SidebarContent onClose={() => setSidebar(false)} />
    </Sheet>
  );
}
