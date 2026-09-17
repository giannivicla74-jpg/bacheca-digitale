// Service Worker per Vi.Cla. Portale PWA
// Versione: 2.5.5 (Supporto Centro Sicurezza Backup & Restore + Regolamento)

const CACHE_NAME_STATIC = 'vicla-static-v2.5.5';
const CACHE_NAME_RUNTIME = 'vicla-runtime-v2.5.5';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './js/firebase-config.js',
  './js/firebase-integration.js',
  './js/database.js',
  './js/auth.js',
  './js/storage.js',
  './js/pdf-splitter.js'
];

// Installa il Service Worker e pre-carica la shell dell'applicazione
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME_STATIC)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[SW] Pre-caching static assets warning:', err);
      })
  );
});

// Attivazione e pulizia vecchie cache
self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME_STATIC, CACHE_NAME_RUNTIME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Pulizia vecchia cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercettazione richieste di rete
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignora richieste non GET o non HTTP(S) (es. chrome-extension://)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Non intercettare le chiamate API dirette di Firebase Firestore/Auth
  // Firebase SDK gestisce internamente la persistenza offline con IndexedDB
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('firebasestorage.googleapis.com')
  ) {
    return;
  }

  // 1. Richieste di navigazione (pagine HTML) -> Network-First con Fallback alla Cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME_STATIC).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallbackIndex = await caches.match('./index.html');
          return fallbackIndex || Response.error();
        })
    );
    return;
  }

  // 2. Asset statici locali e CDN (FontAwesome, Google Fonts, Tailwind, PDF.js) -> Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            const targetCache = STATIC_ASSETS.includes(url.pathname) ? CACHE_NAME_STATIC : CACHE_NAME_RUNTIME;
            caches.open(targetCache).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // In caso di errore di rete, se non in cache, restituisce nulla senza crashare
          return cachedResponse || Response.error();
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// 3. Gestione Notifiche Push PWA e Clic Notifica
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetTab = notifData.targetTab || 'notices';
  const urlToOpen = new URL(notifData.url || './index.html', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('index.html') && 'focus' in client) {
          try {
            client.postMessage({ action: 'NAVIGATE_TAB', targetTab: targetTab });
          } catch(e) {}
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  let title = 'Vi.Cla. Future S.r.l.';
  let body = 'Hai una nuova notifica aziendale';
  let notifData = { url: './index.html' };

  try {
    if (event.data) {
      const parsed = event.data.json();
      title = parsed.title || parsed.notification?.title || title;
      body = parsed.body || parsed.message || parsed.notification?.body || body;
      notifData = parsed.data || parsed;
    }
  } catch (e) {
    if (event.data) body = event.data.text();
  }

  const options = {
    body: body,
    icon: './icons/icon.svg',
    badge: './icons/icon.svg',
    vibrate: [200, 100, 200],
    data: notifData,
    actions: [
      { action: 'open', title: 'Apri Richiesta' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});
