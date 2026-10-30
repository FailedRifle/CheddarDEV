import { createServer } from "node:http";
import { logging, server as wisp } from "@mercuryworkshop/wisp-js/server";

logging.set_level(logging.NONE);
const server = createServer((_request, response) => {
  response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  response.end("Wisp WebSocket endpoint");
});
server.on("upgrade", (request, socket, head) => {
  if (request.headers.upgrade?.toLowerCase() !== "websocket") return socket.end();
  wisp.routeRequest(request, socket, head);
});
export default server;
