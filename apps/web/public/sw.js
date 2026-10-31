// Hira service worker. Keeps the app shell available and shows /offline without a connection.
// API calls and the answer stream go straight to the server: chats are never cached.
const VERSION = 'v1';
const STATIC_CACHE = `hira-static-${VERSION}`;
const PAGE_CACHE = `hira-pages-${VERSION}`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(saveOfflinePage().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  const current = [STATIC_CACHE, PAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith('hira-') && !current.includes(name)).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // Files under /_next/static have a content hash in their name, so a cached copy can never be stale.
  if (url.pathname.startsWith('/_next/static/')) event.respondWith(fromCacheFirst(request));
});

// The offline page needs its own scripts and styles when there is no connection to fetch them.
async function saveOfflinePage() {
  const response = await fetch(OFFLINE_URL);
  const pages = await caches.open(PAGE_CACHE);
  await pages.put(OFFLINE_URL, response.clone());
  const html = await response.text();
  const assets = new Set([...html.matchAll(/\/_next\/static\/[^"'\\\s)]+/g)].map((match) => match[0]));
  const statics = await caches.open(STATIC_CACHE);
  await Promise.allSettled([...assets].map((asset) => statics.add(asset)));
}

async function fromCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}
