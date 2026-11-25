/**
 * ZENO Service Worker — 和の通信 (Harmonious Offline Cache)
 * Stale-while-revalidate for static shell; bypasses /api/* and no-store responses.
 */

const CACHE_NAME = "zeno-v20-zen-landing-eli5-v1160";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/welcome",
  "/landing.css",
  "/landing.js",
  "/illustrations/zen-enso-hero.svg",
  "/illustrations/eli5-vault-scales.svg",
  "/illustrations/eli5-kintsugi-ledger.svg",
  "/illustrations/eli5-sanpo-yoshi.svg",
  "/illustrations/eli5-how-to-use.svg",
  "/us",
  "/us.css",
  "/us.js",
  "/zeno-engine.js",
  "/zeno-client.wasm",
  "/us-rust",
  "/us-rust/boot.js",
  "/us-rust/zeno_leptos.js",
  "/us-rust/zeno_leptos_bg.wasm",
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

  // Never intercept non-GET, cross-origin, or API endpoints (avoid caching sensitive JSON/JWTs)
  if (
    event.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  const shouldCache = (response) => {
    if (!response || !response.ok || response.type !== "basic") return false;
    const cc = (response.headers.get("cache-control") || "").toLowerCase();
    return !cc.includes("no-store");
  };

  // Network-first for HTML, Stale-while-revalidate for static assets
  if (event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (shouldCache(response)) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (shouldCache(networkResponse)) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
