// Ettayea VPN — Service Worker (offline support)
// Bump CACHE_VERSION whenever the shell assets change.
const CACHE_VERSION = 'ettayea-site-v1';
const SHELL = [
  '/',
  '/index.html',
  '/icon.png',
  '/manifest.json',
  '/app-ads.txt',
  '/admin/',
  '/admin/index.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Firebase, ads, Telegram… → network

  // The APK (~39 MB) is never stored in the SW cache — always from network.
  if (url.pathname.endsWith('.apk')) return;

  // Pages: network-first so the "Download vX.Y" text is never stale;
  // the cached copy is the offline fallback.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
    );
    return;
  }

  // Static assets: cache-first, refresh in the background.
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        return res;
      }).catch(() => hit);
      return hit || network;
    })
  );
});
