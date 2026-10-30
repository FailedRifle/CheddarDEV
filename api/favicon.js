const MAX_ICON_BYTES = 128 * 1024;

export default async function handler(request, response) {
  const rawUrl = request.query?.url;
  let origin;

  try {
    const target = new URL(String(rawUrl || ""));
    if (!/^https?:$/.test(target.protocol) || target.username || target.password) {
      throw new Error("Invalid favicon origin");
    }
    origin = target.origin;
  } catch {
    response.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    response.end("Invalid favicon origin");
    return;
  }

  try {
    const iconUrl = new URL("https://www.google.com/s2/favicons");
    iconUrl.searchParams.set("domain_url", origin);
    iconUrl.searchParams.set("sz", "32");
    const upstream = await fetch(iconUrl, {
      headers: { "user-agent": "Mozilla/5.0 \u0043\u0068\u0065\u0064\u0064\u0061\u0072\u004f\u0053 favicon fetch" },
      signal: AbortSignal.timeout(8000),
    });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("Favicon unavailable");
      return;
    }

    const icon = Buffer.from(await upstream.arrayBuffer());
    if (icon.length > MAX_ICON_BYTES) {
      response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
      response.end("Favicon too large");
      return;
    }

    response.writeHead(200, {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
      "cross-origin-resource-policy": "same-origin",
    });
    response.end(icon);
  } catch (error) {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    response.end("Favicon unavailable");
  }
}
