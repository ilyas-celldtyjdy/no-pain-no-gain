/* Service worker : met l'appli en cache pour qu'elle marche hors ligne.
   Stratégie : "stale-while-revalidate" (réponse immédiate depuis le cache, mise à jour en arrière-plan).
   Incrémente CACHE à chaque changement des fichiers pour forcer le renouvellement. */
const CACHE = "npng-v1";
const ASSETS = [
  "./", "index.html", "manifest.webmanifest",
  "css/style.css", "fonts/fonts.css", "fonts/font1.woff2", "fonts/font2.woff2",
  "js/data.js", "js/lib.js", "js/extras.js", "js/app.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return hit || (await net) || (await c.match("index.html"));
  }));
});
