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

for (const entry of ["injector.html", "robots.txt", "core", "loader", "proxy-assets"]) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}
await cp(path.join(output, "injector.html"), path.join(output, "index.html"));

const modules = [
  ["@mercuryworkshop/bare-mux/dist", "baremux"],
  ["@mercuryworkshop/epoxy-transport/dist", "epoxy"],
  ["@mercuryworkshop/libcurl-transport/dist", "libcurl"],
  ["@mercuryworkshop/bare-as-module3/dist", "baremod"],
];
for (const [source, destination] of modules) {
  await cp(path.join(installedModules, source), path.join(output, destination), { recursive: true });
}

const runtimeConfig = path.join(output, "core/runtime-config.js");
const configSource = await readFile(runtimeConfig, "utf8");
await writeFile(runtimeConfig, configSource.replace("cloudflarePages: false", "cloudflarePages: true"));

await writeFile(path.join(output, "_headers"), [
  "/proxy-assets/ultraworker.js",
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
].join("\n"));

console.log(`Cloudflare Pages project ready: ${pagesRoot}`);
