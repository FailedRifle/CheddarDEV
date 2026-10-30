const stockSW = "/proxy-assets/scramjet-worker.js?v=2.0.67-alpha.2";
const runtimeScripts = [
  "/scram/scramjet.js",
  "/controller/controller.api.js",
  "/utils/scramjet-utils.js",
];
const transportModules = {
  epoxy: "/epoxy/index.mjs?v=3.0.2",
  libcurl: "/libcurl/index.mjs?v=2.0.6",
};
const validTransports = new Set(Object.keys(transportModules));
const managedFrames = new WeakMap();
let wispURL = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/wisp/`;
let selectedTransport = getTransportChoice();
let currentTransport;
let currentTransportName;
let controller;
let controllerPromise;
let controllerQueue = Promise.resolve();
let registerPromise;
let keepaliveTimer;

function getTransportChoice() {
  const saved = localStorage.getItem("proxy-transport");
  if (validTransports.has(saved)) return saved;
  if (saved === "bare") localStorage.setItem("proxy-transport", "epoxy");
  return "epoxy";
}

function makeURL(input, template = localStorage.getItem("searchEngine")) {
  try {
    return new URL(input).toString();
  } catch {
    const search = template || "https://duckduckgo.com/?q=%s";
    return search.replace("%s", encodeURIComponent(input));
  }
}

function loadScript(src) {
  const absolute = new URL(src, location.href).href;
  const loaded = [...document.scripts].some(script => script.src === absolute && script.dataset.scramjetRuntime === "loaded");
  if (loaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = absolute;
    script.dataset.scramjetRuntime = "loading";
    script.onload = () => {
      script.dataset.scramjetRuntime = "loaded";
      resolve();
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Could not load proxy runtime asset: ${src}`));
    };
    document.head.appendChild(script);
  });
}

function workerMatches(worker) {
  if (!worker) return false;
  try {
    const actual = new URL(worker.scriptURL, location.href);
    const expected = new URL(stockSW, location.href);
    return actual.pathname === expected.pathname && actual.search === expected.search;
  } catch {
    return false;
  }
}

export async function registerSW() {
  if (!navigator.serviceWorker) throw new Error("This browser does not support service workers.");
  if (!registerPromise) {
    registerPromise = (async () => {
      const registration = await navigator.serviceWorker.register(stockSW, {
        scope: "/",
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;
      const current = () => {
        const controlled = navigator.serviceWorker.controller;
        if (workerMatches(controlled)) return controlled;
        return workerMatches(registration.active) ? registration.active : null;
      };
      let worker = current();
      if (!worker) {
        worker = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            cleanup();
            reject(new Error("The Scramjet service worker did not take control. Reload and try again."));
          }, 12000);
          const check = () => {
            const active = current();
            if (active) {
              cleanup();
              resolve(active);
            }
          };
          const cleanup = () => {
            clearTimeout(timeout);
            navigator.serviceWorker.removeEventListener("controllerchange", check);
          };
          navigator.serviceWorker.addEventListener("controllerchange", check);
          check();
        });
      }
      return { registration, serviceworker: worker };
    })().catch(error => {
      registerPromise = null;
      throw error;
    });
  }
  return registerPromise;
}

async function createTransport(name) {
  const module = await import(transportModules[name]);
  const Transport = module.default;
  if (typeof Transport !== "function") throw new Error(`The ${name} transport module did not export a client.`);
  const transport = new Transport({ wisp: wispURL });
  await transport.init();
  return transport;
}

async function bootController() {
  const { serviceworker } = await registerSW();
  for (const src of runtimeScripts) await loadScript(src);

  const api = window.$scramjetController;
  if (!api?.Controller) throw new Error("The Scramjet controller API did not load.");
  api.assertRuntimeScramjetVersion?.();

  currentTransportName = selectedTransport;
  currentTransport = await createTransport(currentTransportName);
  controller = new api.Controller({
    serviceworker,
    transport: currentTransport,
    config: {
      prefix: "/proxy-assets/scramjet/",
      scramjetPath: "/scram/scramjet.js",
      wasmPath: "/scram/scramjet.wasm",
      injectPath: "/controller/controller.inject.js",
    },
  });
  await controller.wait();
  if (!keepaliveTimer) {
    keepaliveTimer = setInterval(() => {
      navigator.serviceWorker.controller?.postMessage("keepalive");
    }, 15000);
  }
  return controller;
}

export function ensureProxyReady() {
  if (!controllerPromise) {
    controllerPromise = bootController().catch(error => {
      controller = null;
      controllerPromise = null;
      currentTransport = null;
      currentTransportName = null;
      throw error;
    });
  }
  return controllerPromise;
}

export async function setTransport(name = getTransportChoice(), { persist = true, reconnect = false } = {}) {
  if (!validTransports.has(name)) throw new TypeError(`Unsupported Scramjet transport: ${name}`);
  selectedTransport = name;
  if (persist) localStorage.setItem("proxy-transport", name);

  if (controller && (reconnect || currentTransportName !== name)) {
    const update = async () => {
      if (currentTransportName === name && !reconnect) return;
      const next = await createTransport(name);
      const previous = currentTransport;
      controller.setTransport(next);
      currentTransport = next;
      currentTransportName = name;
      try { previous?.close?.(); } catch {}
    };
    const pending = controllerQueue.then(update, update);
    controllerQueue = pending.catch(() => {});
    await pending;
  }
}

export function getProxyType() {
  return "SJ";
}

export function getTransport() {
  return currentTransport;
}

export function getWisp() {
  return wispURL;
}

export async function setWisp(endpoint) {
  const parsed = new URL(endpoint, location.href);
  if (!["ws:", "wss:"].includes(parsed.protocol)) throw new TypeError("The Wisp endpoint must use ws:// or wss://.");
  if (wispURL === parsed.href) return;
  wispURL = parsed.href;
  if (controller) await setTransport(currentTransportName || selectedTransport, { persist: false, reconnect: true });
}

export async function proxySJ(input, { frame: element } = {}) {
  if (!(element instanceof HTMLIFrameElement)) {
    throw new TypeError("Scramjet 2 needs the destination iframe so it can register that frame with the controller.");
  }
  const instance = await ensureProxyReady();
  let frame = managedFrames.get(element);
  if (!frame) {
    frame = instance.createFrame(element);
    managedFrames.set(element, frame);
  }
  frame.go(makeURL(input));
  return element.src;
}

export const proxyUV = proxySJ;

export function getOriginalUrl(value, element) {
  const frame = element && managedFrames.get(element);
  if (!frame || !window.$scramjet?.unrewriteUrl) return value || "";
  try {
    return window.$scramjet.unrewriteUrl(value, frame.context) || value || "";
  } catch {
    return value || "";
  }
}

export { getTransportChoice, makeURL };
