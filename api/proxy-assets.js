import { createReadStream } from "node:fs";
import path from "node:path";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";

const assets = {
  "baremux-index": path.join(baremuxPath, "index.mjs"),
  "baremux-worker": path.join(baremuxPath, "worker.js"),
  "epoxy-index": path.join(epoxyPath, "index.mjs"),
  "libcurl-index": path.join(process.cwd(), "node_modules/@mercuryworkshop/libcurl-transport/dist/index.mjs"),
  "baremod-index": path.join(process.cwd(), "node_modules/@mercuryworkshop/bare-as-module3/dist/index.mjs"),
};

export default function handler(request, response) {
  const file = assets[request.query?.asset];
  if (!file) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Proxy asset not found");
    return;
  }

  response.setHeader("content-type", "application/javascript; charset=utf-8");
  response.setHeader("cache-control", "public, max-age=3600");
  createReadStream(file).on("error", () => {
    if (!response.headersSent) response.writeHead(404);
    response.end("Proxy asset not found");
  }).pipe(response);
}
