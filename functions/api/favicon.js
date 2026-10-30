const MAX_ICON_BYTES = 128 * 1024;

export async function onRequest({ request }) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  let origin;
  try {
    const target = new URL(rawUrl || "");
    if (!/^https?:$/.test(target.protocol) || target.username || target.password) throw new Error("Invalid origin");
    origin = target.origin;
  } catch {
    return new Response("Invalid favicon origin", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  try {
    const iconUrl = new URL("https://www.google.com/s2/favicons");
    iconUrl.searchParams.set("domain_url", origin);
    iconUrl.searchParams.set("sz", "32");
    const upstream = await fetch(iconUrl, { signal: AbortSignal.timeout(8000) });
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) throw new Error("Favicon unavailable");
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_ICON_BYTES) throw new Error("Favicon too large");
    return new Response(bytes, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        "cross-origin-resource-policy": "same-origin",
      },
    });
  } catch {
    return new Response("Favicon unavailable", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
