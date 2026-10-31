import "/proxy-assets/uv/uv.bundle.js";
import "/proxy-assets/uv/uv.config.js";
import { BareMuxConnection } from "/baremux/index.mjs";

const WISP_URL = "wss://lunaar.org/wisp/";
const bareMux = new BareMuxConnection("/baremux/worker.js?v=2.1.7");
const transportModules = {
  epoxy: "/epoxy/index.mjs?v=3.0.2",
  openssl: "/libcurl/index.mjs?v=2.0.6",
};
let activeTransport;

export async function setUltravioletTransport(name = "epoxy", { reconnect = false } = {}) {
  const transport = transportModules[name];
  if (!transport) throw new TypeError(`Unsupported transport: ${name}`);
  if (!reconnect && activeTransport === name) return;
  await bareMux.setTransport(transport, [{ wisp: WISP_URL }]);
  activeTransport = name;
}

export async function proxyUV(input) {
  if (!window.__uv$config?.prefix || !window.Ultraviolet?.codec?.xor) {
    throw new Error("Ultraviolet did not initialize.");
  }
  const url = new URL(input, location.href).href;
  const encoded = window.__uv$config.encodeUrl(url);
  return `${window.__uv$config.prefix}${encoded}`;
}

export function originalUVUrl(value) {
  try {
    const current = new URL(value, location.href);
    const prefix = window.__uv$config?.prefix || "/proxy-assets/uv/service/";
    if (!current.pathname.startsWith(prefix)) return "";
    const encoded = current.pathname.slice(prefix.length) + current.search + current.hash;
    const decoded = window.Ultraviolet?.codec?.xor?.decode(encoded) || "";
    return /^https?:\/\//i.test(decoded) ? decoded : "";
  } catch {
    return "";
  }
}

window.cheddarUltravioletOriginalUrl = originalUVUrl;
