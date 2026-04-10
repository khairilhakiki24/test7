/**
 * KasPro Service Worker - Bulletproof Offline Strategy
 * Meng-cache shell aplikasi, library CDN (Tailwind, Lucide, SheetJS, html2canvas).
 */

const CACHE_NAME = 'kaspro-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './dokumentasi.html',
  /* Pastikan Anda sudah membuat folder assets/ dan memasukkan file PNG di bawah ini agar PWA sempurna */
  /* './assets/icon-192x192.png', */
  /* './assets/icon-512x512.png', */

  // Library External (Di-cache agar bisa 100% offline)
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://unpkg.com/lucide@latest'
];

// Install Event - Caching App Shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      // Gunakan catch untuk mencegah kegagalan install jika ada external resource yang gagal dimuat
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn(`Gagal cache: ${url}`, err)))
      );
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate (Super cepat + Offline Bulletproof)
self.addEventListener('fetch', (event) => {
  // Hanya proses GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return dari cache jika ada
      if (cachedResponse) {
        // Fetch dari network secara background untuk update cache (Stale-while-revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* Abaikan error jika offline */ });

        return cachedResponse;
      }

      // Jika tidak ada di cache, ambil dari network
      return fetch(event.request).then((networkResponse) => {
        // Cache resource baru
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Jika offline dan resource belum di-cache, bisa arahkan ke halaman offline.html jika ada
        console.warn('[SW] Fetch failed & offline', err);
        // Mengingat ini SPA/PWA, mengembalikan index.html sebagai fallback navigasi:
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});