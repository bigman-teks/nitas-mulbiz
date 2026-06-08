// ─────────────────────────────────────────────
//  Nita's Mul-Biz — Service Worker
//  Caches shell for offline support
// ─────────────────────────────────────────────

const CACHE_NAME = 'nitas-mulbiz-v1';
const OFFLINE_PAGE = './index.html';

// Files to pre-cache on install
const PRECACHE_URLS = [
  './index.html',
  './manifest.json'
];

// ── Install: pre-cache shell ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, fallback to cache ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (e.g. Firebase API calls)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // For navigation requests: network first, then cache, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh response
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(OFFLINE_PAGE).then(cached => cached || new Response(
            '<h1>You are offline</h1><p>Please reconnect to use Nita\'s Mul-Biz.</p>',
            { headers: { 'Content-Type': 'text/html' } }
          ))
        )
    );
    return;
  }

  // For other same-origin assets: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push Notifications (future-ready) ────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Nita's Mul-Biz", {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-96.png',
      data: { url: data.url || './' }
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || './')
  );
});
