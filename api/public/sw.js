// Self-unregistering service worker. This file used to cache the VenTrack web
// app's shell; the web app is no longer served here, and this is what undoes
// the old one on machines that already installed it.
//
// It matters because the previous worker was CACHE FIRST on index.html,
// app.js and styles.css. Every browser that ever opened the site, and every
// phone that added it to a home screen, holds a complete working copy of the
// old web app and will keep serving it from that copy indefinitely. Deleting
// the files from the server does not reach those installs: nothing asks the
// network again, so nothing ever notices they are gone. The only thing that
// reaches them is a new worker at this same url, because a registered worker
// does re-check its own script.
//
// So this one installs, deletes every cache, unregisters itself, and reloads
// any open window. After that the browser is back to plain HTTP and gets the
// landing page like a first-time visitor. It is deliberately kept here rather
// than deleted: deleting it would leave the old worker registered forever.
//
// Safe to remove once you are confident no installs remain, which realistically
// means a long time. It costs one tiny request, so there is no hurry.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      await self.registration.unregister();
      // Reload anything still open so the user sees the landing page now
      // rather than the next time they happen to launch it.
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        try {
          client.navigate(client.url);
        } catch {
          /* a client that will not navigate is not worth failing over */
        }
      }
    })()
  );
});

// No fetch handler on purpose. With none registered, every request goes
// straight to the network, which is exactly the behaviour being restored.
