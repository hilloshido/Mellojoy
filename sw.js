const CACHE = 'mj-sniper-v3';
const ASSETS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return;
  e.respondWith(
    caches.match(e.request).then(c => c || fetch(e.request).catch(() => caches.match('/')))
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const d = e.data.json();
  e.waitUntil(self.registration.showNotification(d.title || '🎯 Mellojoy', {
    body: d.body || '在庫あり！今すぐ購入',
    icon: '/icons/icon-192.png',
    tag: 'mj-alert',
    requireInteraction: true,
    vibrate: [200,100,200,100,400],
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const u = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type:'window' }).then(wins => {
    const w = wins.find(x => x.focused);
    if (w) w.navigate(u);
    else clients.openWindow(u);
  }));
});
