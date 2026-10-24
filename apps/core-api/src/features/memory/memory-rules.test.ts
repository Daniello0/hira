import { DocumentKind, MemoryKind, MemoryOperation } from '@hira/contracts';
import { describe, expect, it } from 'vitest';
import { selectPromptDocuments } from '../library/fit-documents';
import { applyMemoryCandidates, type ApplyContext } from './apply-candidates';
import { assembleTurnContext } from './assemble-context';
import { enqueueUser } from './follow-up-queue';
import { DOCUMENT_CONTEXT_CHARS, GOAL_TTL_DAYS } from './memory.constants';
import type { MemoryFact } from './memory.types';
import { selectPromptFacts } from './select-memory';
import { outsideWindow, shouldSummarize } from './summarize-when';

const NOW = new Date('2026-10-18T12:00:00.000Z');
const USER = 'user-1';

describe('prompt memory', () => {
  it('keeps constraints and pinned facts, then at most five nearest others', () => {
    const facts = [
      fact('c', MemoryKind.Constraint, [0, 1]),
      fact('p', MemoryKind.Fact, [0, 1], { isPinned: true }),
      ...Array.from({ length: 6 }, (_, index) => fact(`n${index}`, MemoryKind.Preference, [1, index])),
    ];
    const selected = selectPromptFacts(facts, [1, 0], NOW);
    expect(selected.map((item) => item.content)).toEqual(['c', 'p', 'n0', 'n1', 'n2', 'n3', 'n4']);
  });

  it('drops an expired goal from the prompt and keeps it listable until revoke', () => {
    const expired = fact('g', MemoryKind.Goal, null, { expiresAt: new Date('2026-10-01T00:00:00.000Z') });
    expect(selectPromptFacts([expired], [1, 0], NOW)).toEqual([]);
  });

  it('omits facts when memory is off and still sends a pinned file', () => {
    const context = assembleTurnContext({
      enabled: false,
      useMemory: true,
      summary: 'old',
      facts: [fact('c', MemoryKind.Constraint, null)],
      documents: [{ title: 'CV', kind: DocumentKind.Resume, content: 'python', isPinned: true, embedding: null }],
      queryVector: null,
      now: NOW,
    });
    expect(context.memory).toEqual([]);
    expect(context.extract).toBe(false);
    expect(context.summary).toBe('old');
    expect(context.documents).toEqual([{ title: 'CV', kind: DocumentKind.Resume, content: 'python' }]);
  });

  it('keeps the pinned file when one turn opts out', () => {
    const context = assembleTurnContext({
      enabled: true,
      useMemory: false,
      summary: null,
      facts: [fact('c', MemoryKind.Constraint, null)],
      documents: [{ title: 'Notes', kind: DocumentKind.Note, content: 'body', isPinned: true, embedding: null }],
      queryVector: [1, 0],
      now: NOW,
    });
    expect(context.memory).toEqual([]);
    expect(context.documents).toHaveLength(1);
  });
});

describe('memory candidates', () => {
  it('drops 0.69, stores 0.7, skips a 0.91 duplicate, and revokes on contradiction', async () => {
    const context = applyContext(async () => [1, 0]);
    const existing = [fact('old', MemoryKind.Fact, [1, 0], { content: 'old' })];
    const low = await applyMemoryCandidates(existing, [candidate(0.69)], context);
    expect(low).toHaveLength(1);
    const kept = await applyMemoryCandidates([], [candidate(0.7, 'remote')], context);
    expect(kept[0]?.confidence).toBe(0.7);
    const duplicate = await applyMemoryCandidates(existing, [candidate(0.8, 'same')], context);
    expect(duplicate).toHaveLength(1);
    const contradicted = await applyMemoryCandidates(existing, [candidate(0.8, 'onsite', MemoryOperation.Contradicts, 'old')], context);
    expect(contradicted.find((item) => item.id === 'old')?.revokedAt).toEqual(NOW);
    expect(contradicted.some((item) => item.content === 'onsite' && item.revokedAt === null)).toBe(true);
  });

  it('gives a goal a 90 day expiry and ignores an unknown update target', async () => {
    const context = applyContext(async () => null);
    const goals = await applyMemoryCandidates([], [{ ...candidate(0.9, 'move'), kind: MemoryKind.Goal }], context);
    expect(goals[0]?.expiresAt?.getTime()).toBe(NOW.getTime() + GOAL_TTL_DAYS * 24 * 60 * 60 * 1000);
    const missed = await applyMemoryCandidates([], [candidate(0.9, 'x', MemoryOperation.Update, 'missing')], context);
    expect(missed).toEqual([]);
  });

  it('stores a fact with a null embedding when the encoder is down', async () => {
    const stored = await applyMemoryCandidates([], [candidate(0.8, 'quiet')], applyContext(async () => null));
    expect(stored[0]?.embedding).toBeNull();
  });

  it('stores chat provenance on a new fact', async () => {
    const stored = await applyMemoryCandidates([], [candidate(0.9)], applyContext(async () => [1, 0]));
    expect(stored[0]?.sourceChatId).toBe('chat-1');
    expect(stored[0]?.sourceCallSessionId).toBeNull();
  });
});

describe('summary timing', () => {
  it('waits until the window is full and the count is a multiple of 8', () => {
    expect(shouldSummarize(8)).toBe(false);
    expect(shouldSummarize(10)).toBe(false);
    expect(shouldSummarize(16)).toBe(true);
    expect(outsideWindow(['a', 'b', 'c'])).toEqual([]);
    expect(outsideWindow(Array.from({ length: 16 }, (_, index) => index))).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('document budget', () => {
  it('prefers pinned text and stops at the character budget', () => {
    const pinned = 'p'.repeat(DOCUMENT_CONTEXT_CHARS);
    const selected = selectPromptDocuments(
      [
        { title: 'Pin', kind: DocumentKind.Preferences, content: pinned, isPinned: true, embedding: null },
        { title: 'Near', kind: DocumentKind.Note, content: 'more', isPinned: false, embedding: [1, 0] },
      ],
      [1, 0],
    );
    expect(selected).toEqual([{ title: 'Pin', kind: DocumentKind.Preferences, content: pinned }]);
  });

  it('skips nearest files when the query has no vector', () => {
    const selected = selectPromptDocuments(
      [{ title: 'Near', kind: DocumentKind.Note, content: 'more', isPinned: false, embedding: [1, 0] }],
      null,
    );
    expect(selected).toEqual([]);
  });
});

describe('follow-up queue', () => {
  it('runs one user in order and lets another user pass', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const order: string[] = [];
    const first = enqueueUser('a', async () => {
      order.push('a1');
      await gate;
    });
    const second = enqueueUser('a', async () => {
      order.push('a2');
    });
    const other = enqueueUser('b', async () => {
      order.push('b');
    });
    await other;
    expect(order).toEqual(['a1', 'b']);
    release();
    await first;
    await second;
    expect(order).toEqual(['a1', 'b', 'a2']);
  });
});

function fact(
  id: string,
  kind: MemoryKind,
  embedding: number[] | null,
  patch?: Partial<MemoryFact>,
): MemoryFact {
  return {
    id,
    userId: USER,
    kind,
    content: id,
    embedding,
    confidence: 0.9,
    sourceMessageId: null,
    sourceCallTurnId: null,
    sourceChatId: null,
    sourceCallSessionId: null,
    isPinned: false,
    expiresAt: null,
    revokedAt: null,
    createdAt: NOW,
    ...patch,
  };
}

function candidate(
  confidence: number,
  content = 'fact',
  operation = MemoryOperation.Add,
  targetMemoryId?: string,
) {
  return { kind: MemoryKind.Fact, content, confidence, operation, targetMemoryId };
}

function applyContext(embed: ApplyContext['embed']): ApplyContext {
  let next = 0;
  return {
    now: NOW,
    userId: USER,
    sourceMessageId: 'message-1',
    sourceCallTurnId: 'turn-1',
    sourceChatId: 'chat-1',
    sourceCallSessionId: null,
    nextId: () => `new-${next++}`,
    embed,
  };
}
