import {
  makeURL,
  proxySJ,
  ensureProxyReady,
  setTransport,
  setWisp,
  getTransportChoice,
  getOriginalUrl,
} from "/proxy-assets/vaulted-runtime.mjs?v=vaulted-20261020";

// Vaulted routes proxy traffic through the current host's Wisp endpoint.
const wisp = `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/wisp/`;
const handshakeTimeout = 8000;
const startupAttempts = 3;
let proxySetupPromise;
let proxyReconnectPromise;

async function checkWispConnection() {
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
    const fail = () => finish(new Error(`Vaulted could not open its proxy WebSocket at ${wisp}.`));
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
}

async function bootVaultedProxy() {
  let lastError;
  for (let attempt = 1; attempt <= startupAttempts; attempt++) {
    try {
      await checkWispConnection();
      await setWisp(wisp);
      await setTransport(getTransportChoice());
      return await ensureProxyReady();
    } catch (error) {
      lastError = error;
      if (attempt < startupAttempts) await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, 5000)));
    }
  }
  throw lastError;
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
  return proxySJ(makeURL(input), { frame: options.frame });
};

window.cheddarProxyFallback = async (input, options = {}) => {
  await prepareProxy();
  await ensureProxyReady();
  return proxySJ(makeURL(input), { frame: options.frame });
};

window.cheddarProxyOriginalUrl = getOriginalUrl;

