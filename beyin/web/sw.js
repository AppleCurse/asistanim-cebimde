// Servis çalışanı: paneli "ana ekrana kurulabilir" yapar ve statik dosyaları önbelleğe alır.
// API ve WebSocket trafiğine dokunmaz (her zaman ağ).
const ONBELLEK = 'asistan-v1';
const STATIK = ['/statik/stil.css', '/statik/panel.js', '/statik/telefon.js', '/statik/ikon-180.png', '/statik/ikon-192.png', '/statik/ikon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(ONBELLEK).then((c) => c.addAll(STATIK)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((anahtarlar) => Promise.all(anahtarlar.filter((k) => k !== ONBELLEK).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/') || url.pathname === '/saglik') return;
  // Ağ öncelikli; ağ yoksa önbellekten (panel kabuğu çevrimdışı da açılsın, "beden ulaşılamıyor" desin)
  e.respondWith(
    fetch(e.request)
      .then((yanit) => {
        if (yanit.ok && (url.pathname.startsWith('/statik/') || url.pathname === '/' || url.pathname === '/telefon')) {
          const kopya = yanit.clone();
          caches.open(ONBELLEK).then((c) => c.put(e.request, kopya)).catch(() => {});
        }
        return yanit;
      })
      .catch(() => caches.match(e.request).then((c) => c || caches.match(url.pathname === '/telefon' ? '/telefon' : '/'))),
  );
});
