const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

function textResponse(status, message) {
  return new Response(message, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export async function onRequest({ request, env }) {
  const sourceUrl = new URL(request.url).searchParams.get("url");
  if (!sourceUrl) return textResponse(400, "Game URL is required");

  let target;
  try { target = new URL(sourceUrl); } catch { return textResponse(400, "Invalid game URL"); }
  if (target.protocol !== "https:" || !/\.html?$/i.test(target.pathname)) {
    return textResponse(400, "Only catalogued HTTPS HTML games can be loaded here");
  }

  try {
    const catalogResponse = await env.ASSETS.fetch(new Request(new URL("/core/json/games.json", request.url)));
    if (!catalogResponse.ok) return textResponse(503, "Game catalog is unavailable");
    const games = await catalogResponse.json();
    if (!Array.isArray(games) || !games.some((game) => game.url === sourceUrl)) {
      return textResponse(404, "Game URL is not in the catalog");
    }

    const upstream = await fetch(target, {
      redirect: "follow",
      headers: { accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
      signal: AbortSignal.timeout(15000),
    });
    if (!upstream.ok) return textResponse(502, `Game source returned HTTP ${upstream.status}`);
    const declaredSize = Number(upstream.headers.get("content-length") || 0);
    if (declaredSize > MAX_DOCUMENT_BYTES) return textResponse(413, "Game document is too large");
    const document = await upstream.arrayBuffer();
    if (document.byteLength > MAX_DOCUMENT_BYTES) return textResponse(413, "Game document is too large");

    let html = new TextDecoder().decode(document);
    const baseTag = `<base href="${escapeAttribute(sourceUrl)}">`;
    if (/<base\b[^>]*>/i.test(html)) html = html.replace(/<base\b[^>]*>/i, baseTag);
    else if (/<head\b[^>]*>/i.test(html)) html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${baseTag}`);
    else html = `${baseTag}${html}`;
    html = html.replace(
      /https:\/\/rawcdn\.githack\.com\/([^/\s"'<>]+)\/([^/\s"'<>]+)\/([^/\s"'<>]+)\//gi,
      "https://cdn.jsdelivr.net/gh/$1/$2@$3/",
    );

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=300",
        "x-content-type-options": "nosniff",
        "cross-origin-resource-policy": "same-origin",
      },
    });
  } catch (error) {
    console.error("Could not load game document:", error);
    return textResponse(502, "Could not load the game document");
  }
}
