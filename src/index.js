import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import reportHandler from "../api/report.js";
import gptLogHandler from "../api/gpt-log.js";

logging.set_level(logging.NONE);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const packageDist = (name) => path.dirname(require.resolve(name));
const epoxyPath = packageDist("@mercuryworkshop/epoxy-transport");
const libcurlPath = packageDist("@mercuryworkshop/libcurl-transport");
const baremuxPath = packageDist("@mercuryworkshop/bare-mux");
const fastify = Fastify({
  trustProxy: true,
  serverFactory: (handler) => createServer()
    .on("request", (req, res) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      handler(req, res);
    })
    .on("upgrade", (req, socket, head) => {
      if (req.headers.upgrade?.toLowerCase() !== "websocket") return socket.end();
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      if (pathname !== "/wisp/" && !pathname.startsWith("/wisp/")) return socket.end();
      req.url = pathname;
      wisp.routeRequest(req, socket, head);
    }),
});

fastify.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
fastify.register(fastifyStatic, { root: libcurlPath, prefix: "/libcurl/", decorateReply: false });
fastify.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });
fastify.register(fastifyStatic, { root, prefix: "/", decorateReply: true });
fastify.register(fastifyStatic, { root: path.join(root, "proxy-assets"), prefix: "/proxy-assets/", decorateReply: false });
fastify.get("/health", async () => ({ status: "ok" }));
fastify.post("/api/report", async (request, reply) => {
  const response = {
    writeHead(status, headers = {}) {
      reply.code(status);
      for (const [name, value] of Object.entries(headers)) reply.header(name, value);
      return this;
    },
    setHeader(name, value) { reply.header(name, value); },
    end(body) { reply.send(body); },
  };
  await reportHandler(request, response);
});
fastify.post("/api/gpt-log", async (request, reply) => {
  const response = {
    writeHead(status, headers = {}) {
      reply.code(status);
      for (const [name, value] of Object.entries(headers)) reply.header(name, value);
      return this;
    },
    setHeader(name, value) { reply.header(name, value); },
    end(body) { reply.send(body); },
  };
  await gptLogHandler(request, response);
});
fastify.addHook("onSend", async (request, reply, payload) => {
  if (request.url.startsWith("/proxy-assets/unified-worker.js")) {
    reply.header("Service-Worker-Allowed", "/");
  }
  return payload;
});

// Serve the app shell for client-side routes while keeping missing API and
// asset paths as real 404s.
fastify.setNotFoundHandler((request, reply) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (/^\/(?:api|loader|core)\//.test(pathname)) {
    return reply.code(404).send({ message: "Not Found" });
  }
  return reply.type("text/html; charset=utf-8").sendFile("injector.html");
});

fastify.listen({ port: Number(process.env.PORT || 4040), host: "0.0.0.0" })
  .then(() => console.log("\u0043\u0068\u0065\u0064\u0064\u0061\u0072\u004f\u0053 proxy listening on port 4040"))
  .catch((error) => { console.error(error); process.exit(1); });

export { fastify };
