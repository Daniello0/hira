import { describe, expect, it, vi } from 'vitest';
import { SessionStatus } from '../auth/session-status';
import { MAX_MESSAGE_LENGTH, MESSAGE_TOO_LONG } from './chat.constants';
import { START_CHAT_FAILED, START_CHAT_UNREACHABLE, homeDestination, markPendingSend, startChat, takePendingSend } from './start-chat';

describe('startChat', () => {
  it('creates one chat for a real message', async () => {
    const create = vi.fn().mockResolvedValue({ chat: { id: 'c1' }, limited: false });
    await expect(startChat('python jobs', { create })).resolves.toEqual({ kind: 'started', chatId: 'c1' });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('does not call the API for an empty message', async () => {
    const create = vi.fn();
    await expect(startChat('   ', { create })).resolves.toEqual({ kind: 'ignored' });
    expect(create).not.toHaveBeenCalled();
  });

  it('says why an over-long message stays', async () => {
    const create = vi.fn();
    const result = await startChat('x'.repeat(MAX_MESSAGE_LENGTH + 1), { create });
    expect(result).toEqual({ kind: 'failed', message: MESSAGE_TOO_LONG });
    expect(create).not.toHaveBeenCalled();
  });

  it('reports the demo limit', async () => {
    const create = vi.fn().mockResolvedValue({ chat: null, limited: true });
    await expect(startChat('hi', { create })).resolves.toEqual({ kind: 'limited' });
  });

  it('reports a refused request and a dropped connection', async () => {
    await expect(startChat('hi', { create: vi.fn().mockResolvedValue({ chat: null, limited: false }) })).resolves.toEqual({ kind: 'failed', message: START_CHAT_FAILED });
    await expect(startChat('hi', { create: vi.fn().mockRejectedValue(new Error('offline')) })).resolves.toEqual({ kind: 'failed', message: START_CHAT_UNREACHABLE });
  });
});

describe('pending first message', () => {
  it('is handed over exactly once', () => {
    markPendingSend('c1', { useMemory: false });
    expect(takePendingSend('c1')).toEqual({ useMemory: false });
    expect(takePendingSend('c1')).toBeNull();
  });

  it('does not leak to another chat', () => {
    markPendingSend('c1', { useMemory: true });
    expect(takePendingSend('c2')).toBeNull();
    expect(takePendingSend('c1')).toEqual({ useMemory: true });
  });
});

describe('homeDestination', () => {
  it('keeps an account on the home screen', () => {
    expect(homeDestination(SessionStatus.Account, [{ id: 'c1' }])).toBeNull();
  });

  it('reopens the one demo chat', () => {
    expect(homeDestination(SessionStatus.Anonymous, [{ id: 'c1' }])).toBe('/chat/c1');
    expect(homeDestination(SessionStatus.Anonymous, [])).toBeNull();
  });

  it('waits while the session is unknown', () => {
    expect(homeDestination(SessionStatus.Unknown, [{ id: 'c1' }])).toBeNull();
  });
});
