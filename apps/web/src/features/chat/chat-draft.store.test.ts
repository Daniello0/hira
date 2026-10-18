import { describe, expect, it } from 'vitest';
import { useChatDraft } from './chat-draft.store';

describe('useChatDraft', () => {
  it('keeps a draft per chat and drops empty strings', () => {
    useChatDraft.getState().setDraft('chat-a', 'python');
    expect(useChatDraft.getState().draftFor('chat-a')).toBe('python');
    expect(useChatDraft.getState().draftFor('chat-b')).toBe('');
    useChatDraft.getState().setDraft('chat-a', '');
    expect(useChatDraft.getState().draftFor('chat-a')).toBe('');
  });
});
