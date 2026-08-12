// ponytail: plain SW, no Workbox. Bump CACHE version to purge stale caches.
// SPEC 9.11: /api/* network-only, never cached. AI Judge = only offline-degrading feature.
const CACHE = "mtg-life-v2";

const PRECACHE = [
  "/",
  "/manifest.json",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Non-GET: let browser handle, never cache.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin (fonts, APIs): fetch directly, never cache.
  if (url.origin !== self.location.origin) return;

  // /api/* network-only (SPEC 9.11).
  if (url.pathname.startsWith("/api/")) return;

  // Navigation: network-first, fall back to app shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/"))
        .then((response) => response || new Response("Offline", { status: 503 })),
    );
    return;
  }

  // Same-origin GET (hashed chunks, images): cache-first, runtime-cache misses.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
