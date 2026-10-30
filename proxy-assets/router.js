// The browser page does not include Ultraviolet's global scripts itself.
// Load them before proxyUV reads the global config when a search is submitted.
import "/proxy-assets/uv/uv.bundle.js";
import "/proxy-assets/uv/uv.config.js";
import {
  makeURL,
  proxySJ,
  proxyUV,
  ensureProxyReady,
  registerSW,
  setTransport,
  setWisp,
  getProxyType,
  getTransportChoice,
} from "/proxy-assets/lithium.mjs?v=12";

// Match Vaulted's working Wisp route. The Pages /wisp/ relay closes WebSocket
// handshakes (1006), so use the upstream endpoint directly instead.
const wisp = "wss://lunaar.org/wisp/";
let proxySetupPromise;
let proxyReconnectPromise;

function prepareProxy() {
  if (!proxySetupPromise) {
    proxySetupPromise = (async () => {
      await setWisp(wisp);
      await setTransport(getTransportChoice());
      await registerSW();
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
      await setWisp(wisp);
      await setTransport(getTransportChoice(), { persist: false, reconnect: true });
      await registerSW();
    })().finally(() => {
      proxyReconnectPromise = null;
    });
  }
  return proxyReconnectPromise;
}

window.addEventListener("online", () => {
  reconnectProxy().catch((error) => console.warn("Proxy reconnect deferred", error));
});

export async function configureTransport(transport) {
  await prepareProxy();
  await setTransport(transport);
}

window.cheddarProxyOpen = async (input, options = {}) => {
  await prepareProxy();
  const url = makeURL(input);
  const destinationHost = new URL(url).hostname.toLowerCase();
  const isDuckDuckGo = destinationHost === "duckduckgo.com" || destinationHost.endsWith(".duckduckgo.com");
  const isYouTube = destinationHost === "youtu.be" || destinationHost === "youtube.com" || destinationHost.endsWith(".youtube.com");
  // DuckDuckGo rejects searches sent through the Bare Server egress, so route
  // DuckDuckGo through Epoxy/Wisp for this browsing session.
  if (isDuckDuckGo && getTransportChoice() === "bare") {
    await setTransport("epoxy", { persist: false });
  }
  const selected = options.backend === "UV" ? "UV" : options.backend === "SJ" ? "SJ" : isYouTube ? "SJ" : getProxyType();
  try {
    if (selected === "SJ") {
      await ensureProxyReady();
      return await proxySJ(url);
    }
    return await proxyUV(url);
  } catch (error) {
    console.warn("Proxy startup failed; reconnecting transport and retrying", error);
    await reconnectProxy();
    if (selected === "SJ") {
      await ensureProxyReady();
      return proxySJ(url);
    }
    try {
      return await proxyUV(url);
    } catch (retryError) {
      if (options.backend === "UV") throw retryError;
      console.warn("UV retry failed; falling back to Scramjet", retryError);
      await ensureProxyReady();
      return proxySJ(url);
    }
  }
};

// UV creates its proxy URL before the upstream page is fetched, so network
// failures happen after cheddarProxyOpen has returned. Expose an explicit
// Scramjet retry for the browser shell to use when UV renders its error page.
window.cheddarProxyFallback = async (input) => {
  await prepareProxy();
  await ensureProxyReady();
  return proxySJ(makeURL(input));
};

window.addEventListener("load", () => {
  prepareProxy().catch((error) => console.warn("Proxy startup deferred", error));
});
