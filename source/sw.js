// StrokePulse service worker — build __BUILD__
const CACHE = 'strokepulse-__BUILD__';
const CORE = ['/', '/manifest.webmanifest?v=__BUILD__', '/icon.svg?v=__BUILD__', '/icon-192.png?v=__BUILD__', '/apple-touch-icon.png?v=__BUILD__', '/cox.js?v=__BUILD__', '/analytics.js?v=__BUILD__', '/train.js?v=__BUILD__', '/leaflet.js?v=__BUILD__', '/leaflet.css?v=__BUILD__'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin')) return;
  // Always serve this build's cached copy (works with no signal on the water); new builds arrive via the service worker update.
  const key = e.request.mode === 'navigate' ? '/' : e.request;
  e.respondWith(caches.open(CACHE).then(c => c.match(key).then(hit => hit || fetch(e.request).then(r => { if (r.ok && e.request.mode !== 'navigate') c.put(e.request, r.clone()); return r; }))));
});
