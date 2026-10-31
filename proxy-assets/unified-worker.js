// Keep one root-scoped service worker for both proxy engines. Vaulted handles
// its own routes; Ultraviolet handles only URLs under its service prefix.
importScripts("/vaulted-assets/vaulted-worker.js");
importScripts("/proxy-assets/uv/uv.bundle.js");
importScripts("/proxy-assets/uv/uv.config.js");
importScripts("/proxy-assets/uv/uv.sw.js");

const ultraviolet = new UVServiceWorker();

self.addEventListener("fetch", (event) => {
  if (ultraviolet.route(event)) event.respondWith(ultraviolet.fetch(event));
});
