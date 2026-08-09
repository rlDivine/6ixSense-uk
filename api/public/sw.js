// Minimal service worker: app-shell caching for installability + offline shell.
// Bump this whenever a shell file changes. The fetch handler is cache first,
// so returning users keep the old app.js, styles.css and index.html until the
// name changes and the activate handler deletes the previous cache. This v1
// ships the VenTrack rename on top of the Beacon mark, the softened dark
// palette and the category artwork.
const CACHE = "ventrack-uk-v1";
const SHELL = ["./", "index.html", "styles.css", "app.js", "manifest.json", "icon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Never cache the live API or map tiles. Those always go to network.
  if (url.pathname.startsWith("/api/") || url.host.includes("basemaps") || url.host.includes("unpkg")) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
