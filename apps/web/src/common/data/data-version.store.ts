import { create } from 'zustand';

/** A kind of server data shown on screen. `session` is sign-in and sign-out in another tab. */
export type DataTopic = 'favorites' | 'memory' | 'profile' | 'library' | 'chats' | 'account' | 'session';

const CHANNEL = 'hira-data';
const FOCUS_THROTTLE_MS = 5_000;
/** What may have changed while the tab was away. A form being edited is not reloaded behind the user's back. */
const ON_FOCUS: readonly DataTopic[] = ['favorites', 'memory', 'library', 'chats', 'account'];

interface DataVersionState {
  versions: Partial<Record<DataTopic, number>>;
  bump: (topics: readonly DataTopic[]) => void;
}

const useVersions = create<DataVersionState>((set) => ({
  versions: {},
  bump: (topics) =>
    set((state) => {
      const versions = { ...state.versions };
      for (const topic of topics) versions[topic] = (versions[topic] ?? 0) + 1;
      return { versions };
    }),
}));

/** Screens put this in their load effect, so a change anywhere makes them read again. */
export function useDataVersion(topic: DataTopic): number {
  return useVersions((state) => state.versions[topic] ?? 0);
}

/** The data changed: this tab and the others read it again. */
export function invalidate(...topics: DataTopic[]): void {
  useVersions.getState().bump(topics);
  notifyOtherTabs(...topics);
}

/** Tells the other tabs only. This tab already has the new state. */
export function notifyOtherTabs(...topics: DataTopic[]): void {
  if (typeof BroadcastChannel === 'undefined') return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage(topics);
  channel.close();
}

/** Listens to the other tabs and to the return to this tab. Returns the cleanup. */
export function startDataSync(now: () => number = Date.now): () => void {
  let lastFocus = now();
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL);
  if (channel !== null) channel.onmessage = (event: MessageEvent<DataTopic[]>) => useVersions.getState().bump(event.data);
  const onReturn = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    if (now() - lastFocus < FOCUS_THROTTLE_MS) return;
    lastFocus = now();
    useVersions.getState().bump(ON_FOCUS);
  };
  window.addEventListener('focus', onReturn);
  document.addEventListener('visibilitychange', onReturn);
  return () => {
    channel?.close();
    window.removeEventListener('focus', onReturn);
    document.removeEventListener('visibilitychange', onReturn);
  };
}

/** Test seam: the version a topic is at. */
export function dataVersion(topic: DataTopic): number {
  return useVersions.getState().versions[topic] ?? 0;
}
