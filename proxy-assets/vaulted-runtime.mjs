const stockSW = "/9byt8m.js";
const runtimeScripts = [
  "/cfvi4/szst2w.js",
  "/6m9rd/ybnwpk.js",
];
const transportModules = {
  epoxy: "/epoxy/index.mjs?v=3.0.2",
  openssl: "/libcurl/index.mjs?v=2.0.6",
};
const validTransports = new Set(Object.keys(transportModules));
const proxyPathSegment = "iljfw8/";
const vaultedCodec = {
  encode(value) {
    if (!value) return value;
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  },
  decode(value) {
    if (!value) return value;
    let encoded = value.replace(/-/g, "+").replace(/_/g, "/");
    while (encoded.length % 4) encoded += "=";
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  },
};
const managedFrames = new WeakMap();
// Cloudflare Pages' same-origin Wisp relay closes the WebSocket handshake
// before the transport can use it. Match the working Cheddar deployment and
// connect directly to the Wisp service.
let wispURL = "wss://lunaar.org/wisp/";
let selectedTransport = getTransportChoice();
let currentTransport;
let currentTransportName;
let controller;
let controllerPromise;
let controllerQueue = Promise.resolve();
let registerPromise;

function getTransportChoice() {
  let saved = localStorage.getItem("proxy-transport");
  if (saved === "libcurl") {
    saved = "openssl";
    localStorage.setItem("proxy-transport", saved);
  }
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
    const expectedName = stockSW.split("/").pop();
    return actual.pathname.split("/").pop() === expectedName;
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
        updateViaCache: "all",
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
            reject(new Error("The Vaulted proxy service worker did not take control. Reload and try again."));
          }, 45000);
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
  const { registration, serviceworker } = await registerSW();
  for (const src of runtimeScripts) await loadScript(src);

  const api = window._yta30ly;
  if (!api?.Controller) throw new Error("The Vaulted proxy controller did not load.");
  api.assertRuntime_e50bgxoVersion?.();

  currentTransportName = selectedTransport;
  currentTransport = await createTransport(currentTransportName);
  controller = new api.Controller({
    serviceworker,
    transport: currentTransport,
    _2ttyc2bConfig: {},
    config: {
      prefix: `${new URL(registration.scope).pathname}${proxyPathSegment}`,
      codec: vaultedCodec,
      _2ttyc2bPath: "/cfvi4/szst2w.js",
      wasmPath: "/cfvi4/ses5q6.wasm",
      injectPath: "/6m9rd/cs0u3t.js",
    },
  });
  await controller.wait();
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
  if (!validTransports.has(name)) throw new TypeError(`Unsupported Vaulted proxy transport: ${name}`);
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
    throw new TypeError("The Vaulted proxy needs the destination iframe so it can register that frame with its controller.");
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

export function getOriginalUrl(value, element) {
  const frame = element && managedFrames.get(element);
  if (!frame || !window._np0jxat?.unrewriteUrl) return value || "";
  try {
    return window._np0jxat.unrewriteUrl(value, frame.context) || value || "";
  } catch {
    return value || "";
  }
}

export { getTransportChoice, makeURL };
