/* =========================================================
   ONDA — service worker (auto-aggiornante)

   Come funziona l'aggiornamento automatico:
   - HTML → network-first: quando sei online vedi SEMPRE
     l'ultima versione della pagina.
   - CSS / JS / icone → stale-while-revalidate: la pagina si
     apre subito dalla cache, ma in background il file viene
     riscaricato e la cache aggiornata. Alla visita successiva
     (o al reload automatico gestito da app.js) hai la nuova
     versione, SENZA cambiare numeri di versione a mano.
   - Quando questo file cambia, self.skipWaiting() +
     clients.claim() attivano subito il nuovo SW; app.js
     ascolta "controllerchange" e ricarica la pagina da solo
     (se non c'è una radio in riproduzione).

   Quindi: NON serve più aumentare CACHE a ogni rilascio.
   Il nome resta solo per poter ripartire puliti in caso di
   cambi strutturali gravi (es. rinomini le cartelle).
   ========================================================= */
const CACHE = 'onda-auto-v1';

const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/hls.min.js',
  './js/native-bridge.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      // Precache "resiliente": se un file manca (es. progetto senza
      // native-bridge.js) gli altri vengono comunque messi in cache.
      Promise.all(
        ASSETS.map((a) =>
          c.add(new Request(a, { cache: 'no-cache' })).catch(() => {})
        )
      )
    ).then(() => self.skipWaiting())
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

  // Solo GET same-origin. Stream audio, API Radio Browser e CDN
  // passano sempre dalla rete, mai in cache.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const accept = req.headers.get('accept') || '';

  // ---- HTML / navigazione → network-first (cache solo offline) ----
  if (req.mode === 'navigate' || accept.includes('text/html')) {
    e.respondWith(
      fetch(req, { cache: 'no-cache' })
        .then((r) => {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // ---- Asset locali → stale-while-revalidate ----
  // Risposta immediata dalla cache; in parallelo si scarica la
  // versione nuova e si aggiorna la cache per la prossima volta.
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const cached = await c.match(req);
      const network = fetch(req, { cache: 'no-cache' })
        .then((r) => {
          if (r && r.ok) c.put(req, r.clone());
          return r;
        })
        .catch(() => null);
      // Se in cache c'è → subito quella; altrimenti aspetta la rete.
      return cached || network.then((r) => r || Response.error());
    })
  );
});

// app.js può chiedere l'attivazione immediata di un SW in attesa.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
