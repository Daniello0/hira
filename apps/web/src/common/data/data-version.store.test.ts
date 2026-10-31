import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataVersion, invalidate, notifyOtherTabs, startDataSync } from './data-version.store';

function fakePage() {
  const listeners = new Map<string, () => void>();
  const target = {
    addEventListener: (name: string, run: () => void) => listeners.set(name, run),
    removeEventListener: (name: string) => listeners.delete(name),
    visibilityState: 'visible',
  };
  vi.stubGlobal('window', target);
  vi.stubGlobal('document', target);
  return { fire: (name: string) => listeners.get(name)?.(), target };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

describe('data version', () => {
  let stop: (() => void) | null = null;

  beforeEach(() => {
    fakePage();
  });

  afterEach(() => {
    stop?.();
    stop = null;
    vi.unstubAllGlobals();
  });

  it('moves the version of a changed topic only', () => {
    const favorites = dataVersion('favorites');
    const memory = dataVersion('memory');
    invalidate('favorites');
    expect(dataVersion('favorites')).toBe(favorites + 1);
    expect(dataVersion('memory')).toBe(memory);
  });

  it('hears a change from another tab', async () => {
    stop = startDataSync();
    const before = dataVersion('library');
    notifyOtherTabs('library');
    await settle();
    expect(dataVersion('library')).toBe(before + 1);
  });

  it('re-reads on the return to the tab, at most every few seconds, and leaves a form alone', () => {
    const page = fakePage();
    let now = 0;
    stop = startDataSync(() => now);
    const chats = dataVersion('chats');
    const profile = dataVersion('profile');
    now = 1_000;
    page.fire('focus');
    expect(dataVersion('chats')).toBe(chats);
    now = 10_000;
    page.fire('focus');
    page.fire('visibilitychange');
    expect(dataVersion('chats')).toBe(chats + 1);
    expect(dataVersion('profile')).toBe(profile);
  });

  it('ignores the tab being hidden', () => {
    const page = fakePage();
    let now = 0;
    stop = startDataSync(() => now);
    const chats = dataVersion('chats');
    page.target.visibilityState = 'hidden';
    now = 10_000;
    page.fire('visibilitychange');
    expect(dataVersion('chats')).toBe(chats);
  });
});
