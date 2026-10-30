import {
  makeURL,
  proxySJ,
  ensureProxyReady,
  setTransport,
  setWisp,
  getTransportChoice,
  getOriginalUrl,
} from "/proxy-assets/scramjet-runtime.mjs?v=2.0.67-alpha.2";

// Vaulted routes proxy traffic through the current host's Wisp endpoint.
const wisp = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/wisp/`;
const handshakeTimeout = 8000;
const handshakeAttempts = 3;
let proxySetupPromise;
let proxyReconnectPromise;

async function checkWispConnection() {
  let lastError;
  for (let attempt = 1; attempt <= handshakeAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        let socket;
        let settled = false;
        let timer;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (socket) {
            socket.onopen = socket.onerror = socket.onclose = null;
            try { socket.close(); } catch {}
          }
          error ? reject(error) : resolve();
        };
        const fail = () => finish(new Error(`Wisp WebSocket connection failed: ${wisp}`));
        timer = setTimeout(fail, handshakeTimeout);
        try {
          socket = new WebSocket(wisp);
          socket.onopen = () => finish();
          socket.onerror = fail;
          socket.onclose = fail;
        } catch (error) {
          finish(error);
        }
      });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < handshakeAttempts) await new Promise(resolve => setTimeout(resolve, 300 * attempt));
    }
  }
  throw new Error(`Could not connect to the proxy WebSocket after ${handshakeAttempts} attempts.`, { cause: lastError });
}

function prepareProxy() {
  if (!proxySetupPromise) {
    proxySetupPromise = (async () => {
      await checkWispConnection();
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

function reconnectProxy() {
  if (!proxyReconnectPromise) {
    proxyReconnectPromise = (async () => {
      await proxySetupPromise?.catch(() => {});
      await checkWispConnection();
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
  try {
    return await proxySJ(makeURL(input), { frame: options.frame });
  } catch (error) {
    console.warn("Scramjet proxy startup failed; reconnecting and retrying", error);
    await reconnectProxy();
    await ensureProxyReady();
    return proxySJ(makeURL(input), { frame: options.frame });
  }
};

window.cheddarProxyFallback = async (input, options = {}) => {
  await prepareProxy();
  await ensureProxyReady();
  return proxySJ(makeURL(input), { frame: options.frame });
};

window.cheddarProxyOriginalUrl = getOriginalUrl;

window.addEventListener("load", () => {
  prepareProxy().catch(error => console.warn("Proxy startup deferred", error));
});
