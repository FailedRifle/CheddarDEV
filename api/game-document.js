import { readFile } from "node:fs/promises";
import path from "node:path";

const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
let allowedGameUrlsPromise;

async function allowedGameUrls() {
  allowedGameUrlsPromise ??= readFile(
    path.join(process.cwd(), "core/json/games.json"),
    "utf8",
  ).then((contents) => new Set(JSON.parse(contents).map((game) => game.url)));
  return allowedGameUrlsPromise;
}

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function htmlResponse(response, status, message) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(message);
}

function gameSourceCandidates(sourceUrl) {
  const candidates = [sourceUrl];
  const parsed = new URL(sourceUrl);
  const githubFile = parsed.pathname.match(/^\/gh\/([^/]+)\/([^/@]+)@([^/]+)\/(.+)$/);
  if (parsed.hostname === "cdn.jsdelivr.net" && githubFile) {
    candidates.push(
      `https://raw.githubusercontent.com/${githubFile[1]}/${githubFile[2]}/${githubFile[3]}/${githubFile[4]}${parsed.search}`,
    );
  }
  return candidates;
}

async function fetchGameSource(sourceUrl) {
  const failures = [];
  for (const candidate of gameSourceCandidates(sourceUrl)) {
    try {
      const response = await fetch(candidate, {
        redirect: "follow",
        headers: { accept: "text/html,text/plain;q=0.9,*/*;q=0.1" },
        signal: AbortSignal.timeout(15000),
      });
      if (response.ok) return { response, sourceUrl: candidate };
      failures.push(`${new URL(candidate).hostname} returned HTTP ${response.status}`);
    } catch (error) {
      failures.push(`${new URL(candidate).hostname} could not be reached`);
    }
  }
  return { error: failures.join("; ") || "No game source was available" };
}

export default async function handler(request, response) {
  const rawUrl = request.query?.url;
  const sourceUrl = Array.isArray(rawUrl) ? rawUrl[0] : rawUrl;

  if (typeof sourceUrl !== "string") {
    htmlResponse(response, 400, "Game URL is required");
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    htmlResponse(response, 400, "Invalid game URL");
    return;
  }

  if (parsedUrl.protocol !== "https:" || !/\.html?$/i.test(parsedUrl.pathname)) {
    htmlResponse(response, 400, "Only catalogued HTTPS HTML games can be loaded here");
    return;
  }

  try {
    if (!(await allowedGameUrls()).has(sourceUrl)) {
      htmlResponse(response, 404, "Game URL is not in the catalog");
      return;
    }

    const source = await fetchGameSource(sourceUrl);
    if (!source.response) {
      htmlResponse(response, 502, `Could not load the game document: ${source.error}`);
      return;
    }
    const { response: upstream, sourceUrl: resolvedSourceUrl } = source;

    const declaredSize = Number(upstream.headers.get("content-length") || 0);
    if (declaredSize > MAX_DOCUMENT_BYTES) {
      htmlResponse(response, 413, "Game document is too large");
      return;
    }

    let documentHtml = Buffer.from(await upstream.arrayBuffer());
    if (documentHtml.length > MAX_DOCUMENT_BYTES) {
      htmlResponse(response, 413, "Game document is too large");
      return;
    }

    let html = documentHtml.toString("utf8");
    const baseTag = `<base href="${escapeAttribute(resolvedSourceUrl)}">`;
    if (/<base\b[^>]*>/i.test(html)) {
      html = html.replace(/<base\b[^>]*>/i, baseTag);
    } else if (/<head\b[^>]*>/i.test(html)) {
      html = html.replace(/<head\b[^>]*>/i, (head) => `${head}${baseTag}`);
    } else {
      html = `${baseTag}${html}`;
    }

    // Unity game copies often hard-code rawcdn.githack.com for their payload
    // files. Use the equivalent pinned jsDelivr path so those files keep
    // working in browsers that cannot load the githack host.
    html = html.replace(
      /https:\/\/rawcdn\.githack\.com\/([^/\s"'<>]+)\/([^/\s"'<>]+)\/([^/\s"'<>]+)\//gi,
      "https://cdn.jsdelivr.net/gh/$1/$2@$3/",
    );

    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
    });
    response.end(html);
  } catch (error) {
    console.error("Could not load game document:", error);
    htmlResponse(response, 502, "Could not load the game document");
  }
}
