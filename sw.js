const CACHE = 'calorie-tracker-v1';

const SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon.svg',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Open Food Facts API — network first, cache as fallback
  if (url.hostname.includes('openfoodfacts.org')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // CDN scripts — cache first (they're versioned/immutable)
  if (url.hostname === 'unpkg.com') {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        caches.open(CACHE).then(c => c.put(request, res.clone()));
        return res;
      }))
    );
    return;
  }

  // App shell — cache first
  e.respondWith(
    caches.match(request).then(cached => cached || fetch(request))
  );
});
