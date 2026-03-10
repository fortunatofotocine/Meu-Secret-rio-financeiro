// Basic Service Worker for PWA installation
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
    // Simple pass-through
    event.respondWith(fetch(event.request));
});
