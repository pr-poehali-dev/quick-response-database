const CACHE_NAME = 'app-v4';
const CACHE_LIMIT = 50;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['/'])));
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) {
        // Есть в кеше — отдаём мгновенно, в фоне обновляем кеш
        fetch(e.request).then(res => {
          if (res && res.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, res.clone()));
          }
        }).catch(() => {});
        return cached;
      }
      // Нет в кеше — идём в сеть и сохраняем
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200) return res;
        return caches.open(CACHE_NAME).then(c => {
          c.keys().then(keys => {
            if (keys.length > CACHE_LIMIT) c.delete(keys[0]);
          });
          c.put(e.request, res.clone());
          return res;
        });
      }).catch(() => caches.match('/'));
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.map(n => n !== CACHE_NAME && caches.delete(n)))));
  return self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    e.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(key => caches.delete(key))))
        .then(() => self.registration.unregister())
        .then(() => self.clients.matchAll())
        .then(clients => clients.forEach(client => client.postMessage({ type: 'CACHE_CLEARED' })))
    );
  }
});
