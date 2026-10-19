const CACHE_NAME = "sunrise-public-v3";
const PUBLIC_SHELL = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

function isSafePublicAsset(url) {
  return PUBLIC_SHELL.includes(url.pathname) ||
    url.pathname.startsWith("/fonts/") ||
    /^\/icon-\d+\.png$/.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Always ask the network for documents. Caching the landing-page HTML can
  // pair an old React tree with newly generated CSS after a deployment/HMR.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(async () => (await caches.match("/offline")) || Response.error()));
    return;
  }

  if (!isSafePublicAsset(url)) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && response.type === "basic" && !response.headers.has("set-cookie") && response.headers.get("cache-control") !== "no-store") {
      event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone())));
    }
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? await caches.match("/offline") : Response.error())));
});
