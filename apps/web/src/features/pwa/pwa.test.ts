import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import manifest from '../../app/manifest';
import { THEME_SURFACE } from '../../styles/theme-colors';

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const ORIGIN = 'http://localhost:3000';

type Listener = (event: FetchEventLike) => void;
interface FetchEventLike {
  request: { url: string; method: string; mode: string };
  respondWith: ReturnType<typeof vi.fn>;
  waitUntil: ReturnType<typeof vi.fn>;
}

function loadWorker() {
  const listeners: Record<string, Listener> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (name: string, listener: Listener) => { listeners[name] = listener; },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  const caches = { open: vi.fn(), match: vi.fn().mockResolvedValue({ cached: true }), keys: vi.fn(), delete: vi.fn() };
  runInNewContext(readFileSync(join(WEB_DIR, 'public/sw.js'), 'utf8'), { self, caches, fetch: vi.fn().mockRejectedValue(new Error('offline')), URL, Promise });
  return (request: FetchEventLike['request']) => {
    const event: FetchEventLike = { request, respondWith: vi.fn(), waitUntil: vi.fn() };
    listeners.fetch?.(event);
    return event.respondWith.mock.calls.length > 0;
  };
}

describe('service worker', () => {
  const handled = loadWorker();
  const get = (url: string, mode = 'cors') => handled({ url, method: 'GET', mode });

  it('never touches the API or the answer stream', () => {
    expect(get('http://localhost:4000/api/v1/chats')).toBe(false);
    expect(handled({ url: 'http://localhost:4000/api/v1/chats/1/messages', method: 'POST', mode: 'cors' })).toBe(false);
    expect(get(`${ORIGIN}/api/anything`)).toBe(false);
  });

  it('leaves writes alone even on its own origin', () => {
    expect(handled({ url: `${ORIGIN}/_next/static/a.js`, method: 'POST', mode: 'cors' })).toBe(false);
  });

  it('caches only versioned static files', () => {
    expect(get(`${ORIGIN}/_next/static/chunks/app.js`)).toBe(true);
    expect(get(`${ORIGIN}/_next/data/x.json`)).toBe(false);
  });

  it('answers page navigation, so offline can show the fallback', () => {
    expect(get(`${ORIGIN}/chat`, 'navigate')).toBe(true);
  });
});

describe('service worker install', () => {
  it('keeps the scripts of the offline page, or that page breaks without a connection', async () => {
    const stored: string[] = [];
    const cache = { put: vi.fn().mockResolvedValue(undefined), add: vi.fn(async (url: string) => { stored.push(url); }) };
    const html = '<script src="/_next/static/chunks/app/offline/page-1.js"></script><link href="/_next/static/css/a.css"/><script src="/_next/static/chunks/app/offline/page-1.js"></script>';
    const listeners: Record<string, (event: { waitUntil: (work: Promise<unknown>) => void }) => void> = {};
    const self = { location: { origin: ORIGIN }, addEventListener: (name: string, listener: (event: never) => void) => { listeners[name] = listener as never; }, skipWaiting: vi.fn() };
    const response = { ok: true, clone: () => response, text: async () => html };
    const fetchMock = vi.fn().mockResolvedValue(response);
    runInNewContext(readFileSync(join(WEB_DIR, 'public/sw.js'), 'utf8'), { self, caches: { open: vi.fn().mockResolvedValue(cache) }, fetch: fetchMock, URL, Promise, Set });
    let work: Promise<unknown> = Promise.resolve();
    listeners.install?.({ waitUntil: (promise) => { work = promise; } });
    await work;
    expect(fetchMock).toHaveBeenCalledWith('/offline');
    expect(stored.sort()).toEqual(['/_next/static/chunks/app/offline/page-1.js', '/_next/static/css/a.css']);
    expect(self.skipWaiting).toHaveBeenCalled();
  });
});

describe('service worker install, failed page', () => {
  it('fails the install on a server error instead of keeping the error as the offline page', async () => {
    const put = vi.fn();
    const listeners: Record<string, (event: { waitUntil: (work: Promise<unknown>) => void }) => void> = {};
    const self = { location: { origin: ORIGIN }, addEventListener: (name: string, listener: (event: never) => void) => { listeners[name] = listener as never; }, skipWaiting: vi.fn() };
    const failed = { ok: false, status: 500, clone: () => failed, text: async () => 'Server error' };
    const fetchMock = vi.fn().mockResolvedValue(failed);
    runInNewContext(readFileSync(join(WEB_DIR, 'public/sw.js'), 'utf8'), { self, caches: { open: vi.fn().mockResolvedValue({ put, add: vi.fn() }) }, fetch: fetchMock, URL, Promise, Set, Error });
    let work: Promise<unknown> = Promise.resolve();
    listeners.install?.({ waitUntil: (promise) => { work = promise; } });
    await expect(work).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});

describe('manifest', () => {
  const data = manifest();

  it('installs as a standalone app in the theme color', () => {
    expect(data.name).toBe('Hira');
    expect(data.display).toBe('standalone');
    expect(data.start_url).toBe('/chat');
    expect(data.background_color).toBe(THEME_SURFACE.dark);
    expect(data.theme_color).toBe(THEME_SURFACE.dark);
  });

  it('points at icons that exist, including a maskable one', () => {
    const icons = data.icons ?? [];
    for (const icon of icons) expect(existsSync(join(WEB_DIR, 'public', icon.src))).toBe(true);
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  });
});

describe('phone layout', () => {
  it('leaves the browser color tag to the theme code, or a navigation resets it to dark', () => {
    expect(readFileSync(join(WEB_DIR, 'src/app/layout.tsx'), 'utf8')).not.toContain('themeColor');
  });

  it('keeps side panels clear of the notch and the home bar', () => {
    const sheet = readFileSync(join(WEB_DIR, 'src/common/components/sheet.tsx'), 'utf8');
    expect(sheet).toContain('pt-safe-top');
    expect(sheet).toContain('pb-safe-bottom');
  });

  it('keeps the page and side panels clear of the notch in landscape', () => {
    const sheet = readFileSync(join(WEB_DIR, 'src/common/components/sheet.tsx'), 'utf8');
    const shell = readFileSync(join(WEB_DIR, 'src/features/shell/app-shell.tsx'), 'utf8');
    for (const name of ['pl-safe-left', 'pr-safe-right']) {
      expect(sheet).toContain(name);
      expect(shell).toContain(name);
    }
  });

  it('animates every row that leaves a list', () => {
    for (const file of ['src/features/profile/profile-skills.tsx', 'src/features/profile/location-picker.tsx', 'src/features/chat/chat-row.tsx']) {
      const source = readFileSync(join(WEB_DIR, file), 'utf8');
      expect(source).toContain('useLeaving');
      expect(source).toContain('motion-row');
    }
  });

  it('hides row actions only for a mouse, because a touch screen has no hover', () => {
    for (const file of ['src/features/chat/chat-row.tsx', 'src/features/chat/message-list.tsx']) {
      const source = readFileSync(join(WEB_DIR, file), 'utf8');
      expect(source).not.toContain('md:opacity-0');
      expect(source).toContain('pointer-fine:opacity-0');
    }
  });
});

describe('container image', () => {
  it('copies public, or the manifest icons and worker are lost', () => {
    const dockerfile = readFileSync(join(WEB_DIR, '../../infra/docker/web.Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/COPY --from=build \/app\/apps\/web\/public/);
  });
});
