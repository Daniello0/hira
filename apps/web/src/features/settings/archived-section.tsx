'use client';

import { MutedText } from '../../common/components/feedback';
import { PageHeading } from '../../common/components/page-frame';
import { ChatRows, LoadMore } from '../chat/chat-sidebar';
import { useChatList } from '../chat/chat-list.store';

/** Archived chats. The usual row menu restores or deletes them. */
export function ArchivedSection() {
  const chats = useChatList((state) => state.chats);
  const loaded = useChatList((state) => state.loaded);
  const archived = chats.filter((chat) => chat.isArchived);
  return (
    <>
      <PageHeading title="Archived chats" />
      <div>
        {loaded && archived.length === 0 ? <MutedText>No archived chats.</MutedText> : null}
        <ChatRows chats={archived} />
        <LoadMore />
      </div>
    </>
  );
}
