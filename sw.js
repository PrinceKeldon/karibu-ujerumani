const VERSION = "mvp0.1-20260702-profile-persistence";
const STATIC_CACHE = `karibu-static-${VERSION}`;
const API_CACHE = `karibu-api-${VERSION}`;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/landing.html",
  "/offline.html",
  "/manifest.webmanifest",
  "/og-image.svg",
  "/icons/icon.svg",
  "/src/config.js",
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

  if (isApiUrl(url)) {
    if (CACHEABLE_API_PATHS.some((path) => url.pathname.startsWith(path))) {
      event.respondWith(networkFirst(request, API_CACHE));
    }
  }
});

function isLocalOrPrivateHost(hostname) {
  return ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname)
    || /^10\./.test(hostname)
    || /^192\.168\./.test(hostname)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
}

function isApiUrl(url) {
  if (url.origin === self.location.origin) return true;
  if (url.port === "8000" && isLocalOrPrivateHost(url.hostname)) return true;
  return url.protocol === "https:";
}

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
