import { MessageRole } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { deleteChat, findChat, insertMessage, updateChat, type Sql } from './typeorm-chat.sql';

const CHAT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MESSAGE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('typeorm chat sql', () => {
  it('reads the chat from the update tuple TypeORM returns', async () => {
    const row = chatRow({ title: 'Next', isArchived: true });
    const db = scripted([[row], 1]);
    const updated = await updateChat(
      db.sql,
      CHAT_ID,
      { userId: USER_ID },
      { title: 'Next', isArchived: true },
    );
    expect(updated).toMatchObject({
      id: CHAT_ID,
      title: 'Next',
      isArchived: true,
      messageCount: 2,
    });
    expect(db.calls[0]?.statement).toContain('title = $4');
    expect(db.calls[0]?.statement).toContain('is_archived = $5');
    expect(db.calls[0]?.params).toEqual([CHAT_ID, USER_ID, null, 'Next', true]);
  });

  it('returns null when an update matches no chat', async () => {
    const db = scripted([[], 0]);
    expect(await updateChat(db.sql, CHAT_ID, { userId: USER_ID }, { title: 'Next' })).toBeNull();
  });

  it('reports a delete that matched nobody', async () => {
    const db = scripted([[], 0]);
    expect(await deleteChat(db.sql, CHAT_ID, { userId: USER_ID })).toBe(false);
  });

  it('reports a delete that removed a row', async () => {
    const db = scripted([[{ id: CHAT_ID }], 1]);
    expect(await deleteChat(db.sql, CHAT_ID, { userId: USER_ID })).toBe(true);
  });

  it('reads a select row that is not wrapped in an update tuple', async () => {
    const db = scripted([chatRow()]);
    expect((await findChat(db.sql, CHAT_ID))?.id).toBe(CHAT_ID);
  });

  it('reads an inserted message from a plain returning list', async () => {
    const db = scripted([messageRow()]);
    const message = await insertMessage(db.sql, {
      chatId: CHAT_ID,
      role: MessageRole.User,
      content: 'python',
    });
    expect(message).toMatchObject({ id: MESSAGE_ID, content: 'python' });
  });
});

function scripted(result: unknown): {
  sql: Sql;
  calls: Array<{ statement: string; params: unknown[] }>;
} {
  const calls: Array<{ statement: string; params: unknown[] }> = [];
  return {
    calls,
    sql: {
      query(statement: string, params?: unknown[]): Promise<unknown> {
        calls.push({ statement, params: params ?? [] });
        return Promise.resolve(result);
      },
    },
  };
}

function chatRow(patch?: { title?: string; isArchived?: boolean }): Record<string, unknown> {
  return {
    id: CHAT_ID,
    userId: USER_ID,
    demoSessionId: null,
    title: patch?.title ?? null,
    summary: null,
    messageCount: 2,
    isArchived: patch?.isArchived ?? false,
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
    updatedAt: new Date('2026-10-18T12:00:00.000Z'),
  };
}

function messageRow(): Record<string, unknown> {
  return {
    id: MESSAGE_ID,
    chatId: CHAT_ID,
    role: MessageRole.User,
    content: 'python',
    intent: null,
    diagnostics: null,
    tokenUsage: null,
    createdAt: new Date('2026-10-18T12:00:00.000Z'),
  };
}
