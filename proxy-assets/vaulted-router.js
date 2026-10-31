import {
  makeURL,
  proxySJ,
  ensureProxyReady,
  setTransport,
  setWisp,
  getTransportChoice,
  getOriginalUrl,
} from "/proxy-assets/vaulted-runtime.mjs?v=vaulted-20261031-2";

const wisp = "wss://lunaar.org/wisp/";
const ultravioletRuntimeUrl = "/proxy-assets/ultraviolet-runtime.mjs?v=ultraviolet-20261031-1";
let proxySetupPromise;
let proxyReconnectPromise;
let ultravioletRuntimePromise;

function selectedBackend() {
  const saved = localStorage.getItem("proxy-backend");
  if (saved === "uv") return "ultraviolet";
  return ["vaulted", "scramjet", "ultraviolet"].includes(saved) ? saved : "vaulted";
}

function backendForUrl(input) {
  const selected = selectedBackend();
  if (selected !== "vaulted") return selected;
  const host = new URL(makeURL(input)).hostname.toLowerCase();
  return host === "tiktok.com" || host.endsWith(".tiktok.com") ? "ultraviolet" : "scramjet";
}

async function loadUltravioletRuntime() {
  if (!ultravioletRuntimePromise) {
    ultravioletRuntimePromise = import(ultravioletRuntimeUrl).catch(error => {
      ultravioletRuntimePromise = null;
      throw error;
    });
  }
  return ultravioletRuntimePromise;
}

async function prepareVaulted() {
  if (!proxySetupPromise) {
    proxySetupPromise = (async () => {
      await setWisp(wisp);
      await setTransport(getTransportChoice());
      await ensureProxyReady();
    })().catch(error => {
      proxySetupPromise = null;
      throw error;
    });
  }
  return proxySetupPromise;
}

async function prepareUltraviolet() {
  const { registerSW } = await import("/proxy-assets/vaulted-runtime.mjs?v=vaulted-20261031-2");
  await registerSW();
  const ultraviolet = await loadUltravioletRuntime();
  await ultraviolet.setUltravioletTransport(getTransportChoice());
  return ultraviolet;
}

function reconnectProxy() {
  if (!proxyReconnectPromise) {
    proxyReconnectPromise = (async () => {
      await proxySetupPromise?.catch(() => {});
      await setWisp(wisp);
      await setTransport(getTransportChoice(), { persist: false, reconnect: true });
      await ensureProxyReady();
      if (ultravioletRuntimePromise) {
        const ultraviolet = await loadUltravioletRuntime();
        await ultraviolet.setUltravioletTransport(getTransportChoice(), { reconnect: true });
      }
    })().finally(() => {
      proxyReconnectPromise = null;
    });
  }
  return proxyReconnectPromise;
}

window.addEventListener("online", () => {
  reconnectProxy().catch(error => console.warn("Proxy reconnect deferred", error));
});

export async function configureTransport(transport) {
  if (selectedBackend() !== "ultraviolet") {
    await prepareVaulted();
    await setTransport(transport);
  }
  if (selectedBackend() !== "scramjet") {
    const ultraviolet = await loadUltravioletRuntime();
    await ultraviolet.setUltravioletTransport(transport);
  }
}

export async function configureBackend(backend) {
  if (!["vaulted", "scramjet", "ultraviolet"].includes(backend)) {
    throw new TypeError(`Unsupported proxy backend: ${backend}`);
  }
  localStorage.setItem("proxy-backend", backend);
  if (backend === "ultraviolet") await prepareUltraviolet();
  else await prepareVaulted();
  return backend;
}

window.cheddarProxyOpen = async (input, options = {}) => {
  const url = makeURL(input);
  if (backendForUrl(url) === "ultraviolet") {
    const ultraviolet = await prepareUltraviolet();
    return ultraviolet.proxyUV(url);
  }
  await prepareVaulted();
  return proxySJ(url, { frame: options.frame });
};

window.cheddarProxyFallback = async (input, options = {}) => {
  const url = makeURL(input);
  if (backendForUrl(url) === "ultraviolet") {
    const ultraviolet = await prepareUltraviolet();
    return ultraviolet.proxyUV(url);
  }
  await prepareVaulted();
  await ensureProxyReady();
  return proxySJ(url, { frame: options.frame });
};

window.cheddarProxyOriginalUrl = getOriginalUrl;

window.addEventListener("load", () => {
  if (selectedBackend() === "ultraviolet") {
    prepareUltraviolet().catch(error => console.warn("Ultraviolet startup deferred", error));
  } else {
    prepareVaulted().catch(error => console.warn("Vaulted proxy startup deferred", error));
  }
});
