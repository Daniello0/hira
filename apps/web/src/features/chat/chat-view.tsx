'use client';

import { useEffect, useState } from 'react';
import { StreamPhase } from './stream-phase';
import { Drawer } from '../../common/components/drawer';
import { useSession } from '../auth/session.store';
import { SessionStatus } from '../auth/session-status';
import { ContextPanel, PanelBody } from './context-panel';
import { MessageInput } from './message-input';
import { MessageList } from './message-list';
import { loadAccountContext, type AccountContext } from './panel-context';
import { useShell } from '../shell/shell.store';
import { useChatScreen } from './use-chat-screen';

/** Chat page: transcript, composer, and the context column. */
export function ChatView({ chatId }: { chatId: string }) {
  const screen = useChatScreen(chatId);
  const status = useSession((state) => state.status);
  const token = useSession((state) => state.accessToken);
  const context = useAccountPanel(status, token);
  const contextOpen = useShell((state) => state.contextOpen);
  const setContext = useShell((state) => state.setContext);
  const account = status === SessionStatus.Account;
  return (
    <ChatColumns
      screen={screen}
      context={context}
      account={account}
      contextOpen={contextOpen}
      onOpenContext={() => setContext(true)}
      onCloseContext={() => setContext(false)}
    />
  );
}

function ChatColumns({
  screen,
  context,
  account,
  contextOpen,
  onOpenContext,
  onCloseContext,
}: {
  screen: ReturnType<typeof useChatScreen>;
  context: AccountContext;
  account: boolean;
  contextOpen: boolean;
  onOpenContext: () => void;
  onCloseContext: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col md:grid md:grid-cols-[1fr_18rem]">
      <ChatColumn screen={screen} account={account} onOpenContext={onOpenContext} />
      <ContextPanel
        intent={screen.turn.intent}
        diagnostics={screen.turn.diagnostics}
        skills={context.skills}
        facts={context.facts}
        account={account}
      />
      <Drawer open={contextOpen} label="Context" onClose={onCloseContext}>
        <PanelBody
          intent={screen.turn.intent}
          diagnostics={screen.turn.diagnostics}
          skills={context.skills}
          facts={context.facts}
          account={account}
        />
      </Drawer>
    </div>
  );
}

function ChatColumn({
  screen,
  account,
  onOpenContext,
}: {
  screen: ReturnType<typeof useChatScreen>;
  account: boolean;
  onOpenContext: () => void;
}) {
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
      />
      <MessageInput
        draft={screen.draft}
        disabled={screen.turn.phase !== StreamPhase.Idle || !screen.ready}
        banner={screen.turn.banner}
        notice={screen.turn.notice}
        account={account}
        onDraft={screen.setDraft}
        onSend={() => void screen.send()}
      />
    </section>
  );
}

function useAccountPanel(status: SessionStatus, token: string | null): AccountContext {
  const [context, setContext] = useState<AccountContext>({ skills: [], facts: [] });
  useEffect(() => {
    if (status !== SessionStatus.Account || token === null) return;
    void loadAccountContext(token).then(setContext);
  }, [status, token]);
  return context;
}
