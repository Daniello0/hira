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

describe('container image', () => {
  it('copies public, or the manifest icons and worker are lost', () => {
    const dockerfile = readFileSync(join(WEB_DIR, '../../infra/docker/web.Dockerfile'), 'utf8');
    expect(dockerfile).toMatch(/COPY --from=build \/app\/apps\/web\/public/);
  });
});
