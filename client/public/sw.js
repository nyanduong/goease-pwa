/* global self, caches, fetch, URL */
const CACHE = 'goease-offline-shell-v5-customer-ui';
const FILES = ['/offline.html', '/offline.js', '/offline.css'];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('goease-offline-shell-') && name !== CACHE)
          await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // API responses, credentials, photos, tiles and authenticated HTML are never cached.
  if (FILES.includes(url.pathname) && !url.search) {
    event.respondWith(
      caches
        .open(CACHE)
        .then(
          async (cache) => (await cache.match(url.pathname)) ?? fetch(request),
        ),
    );
  } else if (request.mode === 'navigate' && !url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return cache.match('/offline.html');
      }),
    );
  }
});
