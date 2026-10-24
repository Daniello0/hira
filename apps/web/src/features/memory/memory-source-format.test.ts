import { describe, expect, it } from 'vitest';
import { MemoryKind, type MemoryFactDto } from '@hira/contracts';
import { formatMemorySource } from './memory-source-format';

describe('formatMemorySource', () => {
  it('links chat provenance and keeps call sessions as text', () => {
    expect(formatMemorySource(fact({ sourceChatId: 'chat-1', sourceMessageId: 'msg-1' }))).toEqual({
      href: '/chat/chat-1',
      label: 'Open source chat',
    });
    expect(formatMemorySource(fact({ sourceCallSessionId: 'call-9', sourceCallTurnId: 'turn-1' }))).toEqual({
      href: null,
      label: 'Call session call-9',
    });
  });
});

function fact(partial: Partial<MemoryFactDto>): MemoryFactDto {
  return { ...baseFact(), ...partial };
}

function baseFact(): MemoryFactDto {
  return {
    id: 'fact-1',
    kind: MemoryKind.Fact,
    content: 'Prefers remote work',
    confidence: 0.9,
    isPinned: false,
    sourceMessageId: null,
    sourceCallTurnId: null,
    sourceChatId: null,
    sourceCallSessionId: null,
    expiresAt: null,
    createdAt: '2026-10-24T12:00:00.000Z',
  };
}
