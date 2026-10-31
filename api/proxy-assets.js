import { createReadStream } from "node:fs";
import path from "node:path";

const root = process.cwd();
const modules = path.join(root, "node_modules/@mercuryworkshop");
const assets = {
  "vaulted-runtime": path.join(root, "vaulted-assets/vaulted-runtime.js"),
  "vaulted-controller": path.join(root, "vaulted-assets/vaulted-controller.js"),
  "vaulted-inject": path.join(root, "vaulted-assets/vaulted-inject.js"),
  "vaulted-worker": path.join(root, "vaulted-assets/vaulted-worker.js"),
  "vaulted-wasm": path.join(root, "vaulted-assets/vaulted-runtime.wasm"),
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
