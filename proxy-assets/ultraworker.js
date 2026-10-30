importScripts("scram/scramjet.all.js");
importScripts("uv/uv.bundle.js");
importScripts("uv/uv.config.js");
importScripts("uv/uv.sw.js");

if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: true,
  });
}

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();
const sw = new UVServiceWorker();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function handleRequest(event) {
  if (sw.route(event)) {
    return sw.fetch(event);
  }

  try {
    await scramjet.loadConfig();
  } catch (error) {
    // A Scramjet storage/config failure must not take down ordinary site pages.
    console.error("Scramjet configuration unavailable:", error);
    return fetch(event.request);
  }
  // Scramjet only receives its configuration when the browser explicitly
  // initializes that proxy. Until then, loadConfig() leaves config unset and
  // route() cannot safely inspect a prefix. Let ordinary site requests pass
  // through so a newly registered worker does not break the browser itself.
  if (scramjet.config && scramjet.route(event)) return scramjet.fetch(event);

  return await fetch(event.request);
}

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event));
});
