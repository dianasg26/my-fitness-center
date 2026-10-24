const V = "mfc-2026-10-23-1";
const CORE = [
  "./", "index.html", "manifest.webmanifest", "css/app.css",
  "js/main.js", "js/store.js", "js/gym.js", "js/views.js", "js/figures.js", "js/calc.js", "js/data.js", "js/util.js", "js/config.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.hostname.endsWith("supabase.co")) return; // never cache API/auth
  e.respondWith((async () => {
    const cache = await caches.open(V);
    const hit = await cache.match(r);
    const net = fetch(r).then((res) => { if (res.ok || res.type === "opaque") cache.put(r, res.clone()); return res; }).catch(() => null);
    if (hit) { net.catch(() => {}); return hit; }
    const res = await net;
    if (res) return res;
    if (r.mode === "navigate") return (await cache.match("index.html")) || new Response("offline", { status: 503 });
    return new Response("", { status: 504 });
  })());
});
