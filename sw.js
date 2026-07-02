const VERSION = "mvp0.1-20260702-auth-fetch-fix";
const STATIC_CACHE = `karibu-static-${VERSION}`;
const API_CACHE = `karibu-api-${VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/src/app.js",
  "/src/api.js",
  "/src/styles.css"
];

const CACHEABLE_API_PATHS = [
  "/geo/states",
  "/geo/cities",
  "/geo/cities/near",
  "/geo/rathaus",
  "/geo/emergency",
  "/health"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => ![STATIC_CACHE, API_CACHE].includes(key))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(networkFirst(request, STATIC_CACHE, "/offline.html"));
      return;
    }

    if (STATIC_ASSETS.includes(url.pathname)) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }
  }

  if (url.origin === "http://127.0.0.1:8000" || url.origin === "http://localhost:8000") {
    if (CACHEABLE_API_PATHS.some((path) => url.pathname.startsWith(path))) {
      event.respondWith(networkFirst(request, API_CACHE));
    }
  }
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName, fallbackPath = null) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackPath) {
      const fallback = await cache.match(fallbackPath);
      if (fallback) return fallback;
    }
    return new Response(JSON.stringify({ offline: true, detail: "No cached response available" }), {
      status: 503,
      headers: { "Content-Type": "application/json" }
    });
  }
}
