/* ONDA — service worker
   - mette in cache la "shell" dell'app per l'uso offline dell'interfaccia
   - NON mette mai in cache gli stream audio (passano sempre dalla rete)
   - HTML: network-first (così vedi sempre l'ultima versione quando sei online)
   - Asset locali (css/js/icone): cache-first
   Ricorda: aumenta il numero di versione CACHE a ogni rilascio per forzare l'update. */
const CACHE = 'onda-v1';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Solo GET same-origin gestite dal SW. Stream audio, API e CDN passano alla rete.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';

  // HTML / navigazione → network-first
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Altri asset locali → cache-first
  e.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
