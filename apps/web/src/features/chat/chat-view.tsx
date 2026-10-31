'use client';

import type { ChatSummary } from '@hira/contracts';
import { Ellipsis, PanelRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useDataVersion } from '../../common/data/data-version.store';
import { Button, buttonClass } from '../../common/components/button';
import { Dialog } from '../../common/components/dialog';
import { IconButton } from '../../common/components/icon-button';
import { Sheet } from '../../common/components/sheet';
import { AlertText, MutedText } from '../../common/components/feedback';
import { TextField } from '../../common/components/text-field';
import { DESKTOP_QUERY, useMediaQuery } from '../../common/hooks/use-media-query';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { AppHeader, UpgradeLink } from '../shell/app-header';
import { useShell } from '../shell/shell.store';
import { deleteChatOnServer, renameChat } from './chat-actions';
import { ChatActionsMenu } from './chat-actions-menu';
import { findChat, useChatList } from './chat-list.store';
import { ContextPanel, PanelBody, PanelHeader, type PanelData } from './context-panel';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';
import { EMPTY_ACCOUNT_CONTEXT, loadAccountContext, type AccountContext } from './panel-context';
import { StreamPhase } from './stream-phase';
import { useChatScreen } from './use-chat-screen';

type Screen = ReturnType<typeof useChatScreen>;

/** Chat page: top bar, transcript, composer, and the context panel. */
export function ChatView({ chatId }: { chatId: string }) {
  const screen = useChatScreen(chatId);
  const status = useSession((state) => state.status);
  const crossChat = useSession((state) => state.user?.crossChatMemoryEnabled ?? false);
  const context = useAccountPanel(status, screen.finishedTurns);
  const contextOpen = useShell((state) => state.contextOpen);
  const setContext = useShell((state) => state.setContext);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const account = status === SessionStatus.Account;
  if (screen.load === 'not-found' || screen.load === 'failed') return <LoadProblem screen={screen} />;
  const panel: PanelData = { intent: screen.turn.intent, diagnostics: screen.turn.diagnostics, context, account, crossChat };
  return (
    <div className="flex h-full">
      <ChatColumn screen={screen} chatId={chatId} account={account} />
      <ContextPanel data={panel} open={contextOpen} onClose={() => setContext(false)} />
      <Sheet open={contextOpen && !desktop} side="right" widthClass="w-panel" label="Context" onClose={() => setContext(false)}>
        <div className="p-4">
          <PanelHeader onClose={() => setContext(false)} />
          <PanelBody data={panel} />
        </div>
      </Sheet>
    </div>
  );
}

function LoadProblem({ screen }: { screen: Screen }) {
  const missing = screen.load === 'not-found';
  return (
    <div className="flex h-full flex-col">
      <AppHeader><UpgradeLink /></AppHeader>
      <section className="motion-enter mx-auto max-w-dialog space-y-3 p-6 text-center" role="alert">
        <h1 className="text-xl font-semibold">{missing ? 'Chat not found' : 'Could not load the chat'}</h1>
        <MutedText>{missing ? 'It may have been deleted, or it belongs to another account.' : 'Check your connection and try again.'}</MutedText>
        <div className="flex justify-center gap-2">
          {missing ? null : <Button onClick={screen.retry}>Try again</Button>}
          <Link className={buttonClass('secondary')} href="/chat">New chat</Link>
        </div>
      </section>
    </div>
  );
}

function ChatColumn({ screen, chatId, account }: { screen: Screen; chatId: string; account: boolean }) {
  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <ChatHeader chatId={chatId} />
      <MessageList
        turn={screen.turn}
        openIds={screen.openIds}
        onToggle={screen.toggle}
        onOlder={screen.loadOlder}
        hasOlder={screen.hasOlder}
        account={account}
      />
      <div className="mx-auto w-full max-w-thread px-4 pb-4">
        <p className="pb-2 text-center text-xs text-ink-tertiary">Hira can make mistakes. Check important info.</p>
        <MessageInput
          draft={screen.draft}
          disabled={screen.turn.phase !== StreamPhase.Idle || !screen.ready}
          archived={screen.archived}
          banner={screen.turn.banner}
          notice={screen.turn.notice}
          account={account}
          useMemory={screen.useMemory}
          includeForeignRemote={screen.includeForeignRemote}
          onUseMemory={screen.setUseMemory}
          onIncludeForeignRemote={screen.setIncludeForeignRemote}
          onDraft={screen.setDraft}
          onSend={() => void screen.send()}
        />
      </div>
    </section>
  );
}

function ChatHeader({ chatId }: { chatId: string }) {
  const contextOpen = useShell((state) => state.contextOpen);
  const setContext = useShell((state) => state.setContext);
  const chat = useChatList((state) => findChat(state, chatId));
  return (
    <AppHeader>
      <IconButton label={contextOpen ? 'Hide context' : 'Show context'} tone={contextOpen ? 'active' : 'muted'} aria-pressed={contextOpen} onClick={() => setContext(!contextOpen)}>
        <PanelRight className="size-icon" aria-hidden="true" />
      </IconButton>
      {chat !== undefined ? <HeaderMenu chat={chat} /> : null}
      <UpgradeLink />
    </AppHeader>
  );
}

function HeaderMenu({ chat }: { chat: ChatSummary }) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = () => {
    void deleteChatOnServer(chat.id, setError).then((ok) => {
      if (!ok) return;
      useChatList.getState().remove(chat.id);
      router.push('/chat');
    });
  };
  return (
    <>
      {error !== null ? <AlertText className="text-xs">{error}</AlertText> : null}
      <ChatActionsMenu
        chat={chat}
        align="end"
        tooltip="Chat actions"
        onRename={() => setRenaming(true)}
        onDelete={remove}
        onError={setError}
        trigger={<IconButton label="Chat actions" tooltip={false}><Ellipsis className="size-icon" aria-hidden="true" /></IconButton>}
      />
      <RenameDialog chat={chat} open={renaming} onClose={() => setRenaming(false)} onError={setError} />
    </>
  );
}

function RenameDialog({ chat, open, onClose, onError }: { chat: ChatSummary; open: boolean; onClose: () => void; onError: (value: string | null) => void }) {
  const [title, setTitle] = useState(chat.title ?? '');
  useEffect(() => {
    if (open) setTitle(chat.title ?? '');
  }, [open, chat.title]);
  return (
    <Dialog open={open} onClose={onClose} title="Rename chat">
      <form
        className="mt-3 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void renameChat(chat, title, onError).finally(onClose);
        }}
      >
        <TextField label="Name" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Profile and memory for the panel. Re-read after every finished turn, since Hira may have learned something. */
function useAccountPanel(status: SessionStatus, finishedTurns: number): AccountContext {
  const memory = useDataVersion('memory');
  const profile = useDataVersion('profile');
  const [context, setContext] = useState<AccountContext>(EMPTY_ACCOUNT_CONTEXT);
  useEffect(() => {
    if (status !== SessionStatus.Account) return;
    let active = true;
    void loadAccountContext()
      .then((next) => {
        if (active) setContext(next);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [status, finishedTurns, memory, profile]);
  return context;
}
