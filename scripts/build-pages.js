import { access, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pagesRoot = path.join(root, "cloudflare-pages");
const output = path.join(pagesRoot, "dist");
let installedModules = path.join(root, "node_modules");
try {
  await access(path.join(pagesRoot, "node_modules"));
  installedModules = path.join(pagesRoot, "node_modules");
} catch { /* The root install is used for local builds. */ }

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await rm(path.join(pagesRoot, "functions"), { recursive: true, force: true });
await cp(path.join(root, "functions"), path.join(pagesRoot, "functions"), { recursive: true });

for (const entry of ["injector.html", "robots.txt", "core", "loader", "proxy-assets", "9byt8m.js", "cfvi4", "6m9rd"]) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
await cp(path.join(output, "injector.html"), path.join(output, "index.html"));

const modules = [
  ["@mercuryworkshop/epoxy-transport/dist", "epoxy"],
  ["@mercuryworkshop/libcurl-transport/dist", "libcurl"],
];
for (const [source, destination] of modules) {
  await cp(path.join(installedModules, source), path.join(output, destination), { recursive: true });
}

const runtimeConfig = path.join(output, "core/runtime-config.js");
const configSource = await readFile(runtimeConfig, "utf8");
await writeFile(runtimeConfig, configSource.replace("cloudflarePages: false", "cloudflarePages: true"));

await writeFile(path.join(output, "_headers"), [
  "/9byt8m.js",
  "  Service-Worker-Allowed: /",
  "  Cache-Control: public, max-age=3600",
  "",
  "/core/json/games.json",
  "  Cache-Control: public, max-age=600, stale-while-revalidate=86400",
  "",
  "/*",
  "  Cross-Origin-Opener-Policy: same-origin-allow-popups",
  "  Cross-Origin-Embedder-Policy: require-corp",
  "  X-Robots-Tag: noindex, nofollow, noarchive",
  "",
  // Remove the inherited COEP after the wildcard rule; Cloudflare processes
  // matching rules in order. The PWA launcher embeds the browser, and Vaulted
  // proxied frames don't all send COEP.
  "/injector.html",
  "  ! Cross-Origin-Embedder-Policy",
  "",
  "/index.html",
  "  ! Cross-Origin-Embedder-Policy",
  "",
  "/",
  "  ! Cross-Origin-Embedder-Policy",
  "",
  "/core/browser",
  "  ! Cross-Origin-Embedder-Policy",
  "",
  "/core/browser.html",
  "  ! Cross-Origin-Embedder-Policy",
  "",
].join("\n"));

console.log(`Cloudflare Pages project ready: ${pagesRoot}`);
