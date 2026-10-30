import { createReadStream } from "node:fs";
import path from "node:path";

const root = process.cwd();
const modules = path.join(root, "node_modules/@mercuryworkshop");
const vaulted = path.join(root, "proxy-assets/vaulted");
const assets = {
  "vaulted-runtime": path.join(vaulted, "cfvi4/szst2w.js"),
  "vaulted-controller": path.join(vaulted, "6m9rd/ybnwpk.js"),
  "vaulted-inject": path.join(vaulted, "6m9rd/cs0u3t.js"),
  "vaulted-worker": path.join(vaulted, "9byt8m.js"),
  "vaulted-wasm": path.join(vaulted, "cfvi4/ses5q6.wasm"),
  epoxy: path.join(modules, "epoxy-transport/dist/index.mjs"),
  openssl: path.join(modules, "libcurl-transport/dist/index.mjs"),
};

export default function handler(request, response) {
  const file = assets[request.query?.asset];
  if (!file) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Proxy asset not found");
    return;
  }

  response.setHeader("content-type", file.endsWith(".wasm") ? "application/wasm" : "application/javascript; charset=utf-8");
  response.setHeader("cache-control", "public, max-age=3600");
  createReadStream(file).on("error", () => {
    if (!response.headersSent) response.writeHead(404);
    response.end("Proxy asset not found");
  }).pipe(response);
}
