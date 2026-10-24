'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '../../common/components/button';
import { Drawer } from '../../common/components/drawer';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { ContextPanel, PanelBody, type PanelData } from './context-panel';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';
import { EMPTY_ACCOUNT_CONTEXT, loadAccountContext, type AccountContext } from './panel-context';
import { useShell } from '../shell/shell.store';
import { StreamPhase } from './stream-phase';
import { useChatScreen } from './use-chat-screen';

type Screen = ReturnType<typeof useChatScreen>;

/** Chat page: transcript, composer, and the context column. */
export function ChatView({ chatId }: { chatId: string }) {
  const screen = useChatScreen(chatId);
  const status = useSession((state) => state.status);
  const crossChat = useSession((state) => state.user?.crossChatMemoryEnabled ?? false);
  const context = useAccountPanel(status, screen.finishedTurns);
  const contextOpen = useShell((state) => state.contextOpen);
  const setContext = useShell((state) => state.setContext);
  const account = status === SessionStatus.Account;
  if (screen.load === 'not-found' || screen.load === 'failed') return <LoadProblem screen={screen} />;
  const panel: PanelData = { intent: screen.turn.intent, diagnostics: screen.turn.diagnostics, context, account, crossChat };
  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[1fr_18rem]">
      <ChatColumn screen={screen} account={account} onOpenContext={() => setContext(true)} />
      <ContextPanel data={panel} />
      <Drawer open={contextOpen} label="Context" onClose={() => setContext(false)}>
        <PanelBody data={panel} />
      </Drawer>
    </div>
  );
}

function LoadProblem({ screen }: { screen: Screen }) {
  const missing = screen.load === 'not-found';
  return (
    <section className="mx-auto max-w-md space-y-3 p-6" role="alert">
      <h1 className="text-xl font-semibold">{missing ? 'Chat not found' : 'Could not load the chat'}</h1>
      <p className="text-sm text-hira-muted">
        {missing ? 'It may have been deleted, or it belongs to another account.' : 'Check your connection and try again.'}
      </p>
      <div className="flex gap-2">
        {missing ? null : <Button type="button" onClick={screen.retry}>Try again</Button>}
        <Link className="rounded-md bg-white/10 px-3 py-2 text-sm" href="/chat">Back to chats</Link>
      </div>
    </section>
  );
}

function ChatColumn({ screen, account, onOpenContext }: { screen: Screen; account: boolean; onOpenContext: () => void }) {
  return (
    <section className="flex min-h-screen flex-col">
      <div className="flex justify-end p-3 md:hidden">
        <button type="button" onClick={onOpenContext}>
          Context
        </button>
      </div>
      <MessageList
        turn={screen.turn}
        openIds={screen.openIds}
        onToggle={screen.toggle}
        onOlder={screen.loadOlder}
        hasOlder={screen.hasOlder}
        account={account}
      />
      <MessageInput
        draft={screen.draft}
        disabled={screen.turn.phase !== StreamPhase.Idle || !screen.ready || screen.archived}
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
    </section>
  );
}

/** Profile and memory for the panel. Re-read after every finished turn, since Hira may have learned something. */
function useAccountPanel(status: SessionStatus, finishedTurns: number): AccountContext {
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
  }, [status, finishedTurns]);
  return context;
}
