// Service worker LETTER C MERDEN.
// Naikkan CACHE_VERSION setiap ada perubahan file di docs/.
const CACHE_VERSION = 'lcm-v2';
const CACHE_CDN = 'lcm-cdn';

const SHELL = [
  './',
  'index.html',
  'offline.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/config.js',
  'js/app.js',
  'js/api.js',
  'js/auth.js',
  'js/db.js',
  'js/router.js',
  'js/ui.js',
  'js/pages/login.js',
  'js/pages/beranda.js',
  'js/pages/cari.js',
  'js/pages/detail-c.js',
  'js/pages/pengaturan.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png'
];

// Jangan pernah dicache: API & login Google
const NETWORK_ONLY = ['script.google.com', 'script.googleusercontent.com', 'googleusercontent.com',
                      'accounts.google.com', 'oauth2.googleapis.com', 'www.googleapis.com'];
const CDN = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== CACHE_CDN).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (NETWORK_ONLY.some(h => url.hostname === h || url.hostname.endsWith('.' + h))) return; // network-only

  if (CDN.some(h => url.hostname === h)) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE_VERSION);
      const shell = await cache.match('index.html');
      if (shell) return shell;
      try { return await fetch(req); } catch (err) { return (await cache.match('offline.html')) || Response.error(); }
    })());
    return;
  }

  // App shell: cache-first
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch (err) {
      return new Response('', { status: 504, statusText: 'Offline' });
    }
  })());
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE_CDN);
  const hit = await cache.match(req);
  const ambil = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || ambil;
}
