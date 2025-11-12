const CACHE_NAME = 'app-v2';
const CACHE_LIMIT = 50;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['/'])));
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (!res || res.status !== 200) return res;
      return caches.open(CACHE_NAME).then(c => {
        c.keys().then(keys => {
          if (keys.length > CACHE_LIMIT) c.delete(keys[0]);
        });
        c.put(e.request, res.clone());
        return res;
      });
    }).catch(() => caches.match('/')))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.map(n => n !== CACHE_NAME && caches.delete(n)))));
  return self.clients.claim();
});