/**
 * ZENO Service Worker — 和の通信 (Harmonious Offline Cache)
 * Stale-while-revalidate for static shell; Network-first for dynamic state.
 */

const CACHE_NAME = "zeno-v7-ultrabackyardloop";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/sound.js",
  "/qrcode.js",
  "/favicon.svg",
  "/og.svg",
  "/favicon.ico",
  "/icons/icon-16.png",
  "/icons/icon-32.png",
  "/icons/icon-48.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/beacon.json",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin external API requests
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for HTML, Stale-while-revalidate for assets
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
