import { createBareServer } from "@tomphttp/bare-server-node";

const bareServer = createBareServer("/api/bare/");

export default function handleBareRequest(request, response) {
  const url = new URL(request.url || "/api/bare/", `https://${request.headers.host || "localhost"}`);
  const rewrittenPath = url.searchParams.get("barePath");
  if (rewrittenPath !== null) {
    url.searchParams.delete("barePath");
    url.pathname = `/api/bare/${rewrittenPath.replace(/^\/+/, "")}`;
  } else if (url.pathname === "/bare" || url.pathname.startsWith("/bare/")) {
    url.pathname = `/api${url.pathname}`;
  }
  if (url.pathname === "/api/bare" || url.pathname === "/api/bare/index") {
    url.pathname = "/api/bare/";
  }
  request.url = `${url.pathname}${url.search}`;

  if (!bareServer.shouldRoute(request)) {
    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ code: "UNKNOWN", id: "error.NotFound" }));
    return;
  }

  void bareServer.routeRequest(request, response);
}
