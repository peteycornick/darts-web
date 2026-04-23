const CACHE_NAME = 'darts-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

// Install Event
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Activate Event to clear old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open tabs immediately
  );
});

// Fetch Event (Offline Capability)
self.addEventListener('fetch', (e) => {
  // Network-First Strategy
  e.respondWith(
    fetch(e.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(e.request, response.clone());
        return response;
      });
    }).catch(() => caches.match(e.request))
  );
});