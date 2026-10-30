import {
  makeURL,
  proxySJ,
  ensureProxyReady,
  setTransport,
  setWisp,
  getTransportChoice,
  getOriginalUrl,
} from "/proxy-assets/vaulted-runtime.mjs?v=vaulted-20261030-2";

// Use the same direct Wisp endpoint as the working Cheddar deployment.
// Cloudflare Pages' same-origin /wisp/ relay closes WebSocket handshakes.
const wisp = "wss://lunaar.org/wisp/";
let proxySetupPromise;
let proxyReconnectPromise;

async function bootVaultedProxy() {
  await setWisp(wisp);
  await setTransport(getTransportChoice());
  return ensureProxyReady();
}

function prepareProxy() {
  if (!proxySetupPromise) {
    proxySetupPromise = bootVaultedProxy().catch(error => {
      proxySetupPromise = null;
      throw error;
    });
  }
  return proxySetupPromise;
}

function reconnectProxy() {
  if (!proxyReconnectPromise) {
    proxyReconnectPromise = (async () => {
      await proxySetupPromise?.catch(() => {});
      await setWisp(wisp);
      await setTransport(getTransportChoice(), { persist: false, reconnect: true });
      await ensureProxyReady();
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
  await prepareProxy();
  await setTransport(transport);
}

window.cheddarProxyOpen = async (input, options = {}) => {
  await prepareProxy();
  return proxySJ(makeURL(input), { frame: options.frame });
};

window.cheddarProxyFallback = async (input, options = {}) => {
  await prepareProxy();
  await ensureProxyReady();
  return proxySJ(makeURL(input), { frame: options.frame });
};

window.cheddarProxyOriginalUrl = getOriginalUrl;

