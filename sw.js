const CACHE = "fidda-store-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./products.html",
  "./product.html",
  "./cart.html",
  "./checkout.html",
  "./style.css",
  "./main.js",
  "./products.js",
  "./supabase-client.js",
  "./fidda-header-logo.png",
  "./logo.png",
  "./hero-bg.jpg",
  "./hero-logo.png",
  "./hero-logo-transparent.png",
  "./icon-192.png",
  "./icon-512.png",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Keep Supabase/API requests live so stock, cart and orders stay real-time.
  if (url.origin !== self.location.origin) return;

  // Always try the network first for HTML so published changes appear immediately.
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Static files: cache first, then update from network.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
