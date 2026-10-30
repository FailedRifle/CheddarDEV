import { createReadStream } from "node:fs";
import path from "node:path";

const modules = path.join(process.cwd(), "node_modules/@mercuryworkshop");
const assets = {
  scramjet: path.join(modules, "scramjet/dist/scramjet.js"),
  "controller-api": path.join(modules, "scramjet-controller/dist/controller.api.js"),
  "controller-worker": path.join(modules, "scramjet-controller/dist/controller.sw.js"),
  "controller-inject": path.join(modules, "scramjet-controller/dist/controller.inject.js"),
  utils: path.join(modules, "scramjet-utils/dist/scramjet-utils.js"),
  epoxy: path.join(modules, "epoxy-transport/dist/index.mjs"),
  libcurl: path.join(modules, "libcurl-transport/dist/index.mjs"),
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
