const DEFAULT_WISP_UPSTREAM = "https://lunaar.org/wisp/";

export async function onRequest({ request, env }) {
  const requestUrl = new URL(request.url);
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return new Response("WebSocket upgrade required", {
      status: 426,
      headers: { "cache-control": "no-store" },
    });
  }

  // Only accept browser connections initiated by this Pages deployment.
  const origin = request.headers.get("Origin");
  if (!origin || origin !== requestUrl.origin) {
    return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } });
  }

  let upstreamUrl;
  try {
    upstreamUrl = new URL(env.WISP_UPSTREAM || DEFAULT_WISP_UPSTREAM);
    if (upstreamUrl.protocol !== "https:" || upstreamUrl.username || upstreamUrl.password) throw new Error("Invalid Wisp upstream");
    upstreamUrl.pathname = `${upstreamUrl.pathname.replace(/\/$/, "")}${requestUrl.pathname.replace(/^\/wisp/, "") || "/"}`;
    upstreamUrl.search = requestUrl.search;
  } catch {
    return new Response("Wisp upstream configuration is invalid", { status: 500, headers: { "cache-control": "no-store" } });
  }

  // Match Vaulted's relay: validate the browser origin against this Pages
  // deployment, then preserve that origin for the upstream Wisp service.
  const headers = new Headers({ Upgrade: "websocket" });
  headers.set("Origin", origin);
  const protocol = request.headers.get("Sec-WebSocket-Protocol");
  if (protocol) headers.set("Sec-WebSocket-Protocol", protocol);

  try {
    const response = await fetch(upstreamUrl, { method: "GET", headers });
    if (response.status === 101 && response.webSocket) return response;
    return new Response("Wisp upstream refused the WebSocket upgrade", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  } catch {
    return new Response("Wisp upstream is unavailable", {
      status: 502,
      headers: { "cache-control": "no-store" },
    });
  }
}
