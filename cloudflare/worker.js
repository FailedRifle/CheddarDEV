import { DurableObject } from "cloudflare:workers";

const CONTAINER_PORT = 4040;
const CONTAINER_INSTANCE = "cheddar-proxy";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export class ProxyContainer extends DurableObject {
  starting;

  constructor(ctx, env) {
    super(ctx, env);
    if (ctx.container.running) {
      void ctx.blockConcurrencyWhile(() =>
        ctx.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS),
      );
    }
  }

  async fetch(request) {
    this.starting ??= this.startAndWaitForPort().finally(() => {
      this.starting = undefined;
    });
    await this.starting;

    const url = new URL(request.url);
    url.protocol = "http:";
    url.host = "container";
    const forwarded = new Request(url, request);
    forwarded.headers.delete("host");

    // Returning the port response directly preserves WebSocket upgrades.
    return this.ctx.container.getTcpPort(CONTAINER_PORT).fetch(forwarded);
  }

  async startAndWaitForPort() {
    const container = this.ctx.container;
    if (!container.running) {
      console.log("Starting cheddar-proxy container", { instance: "standard-1" });
      await container.start({
        image: container.images.base,
        // `standard-1` provides headroom for the proxy and its large asset set.
        // The Durable Object scheduling policy does not accept `basic`.
        instance: "standard-1",
        enableInternet: true,
      });
      console.log("Cloudflare accepted the container start request");
    }

    await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    const port = container.getTcpPort(CONTAINER_PORT);
    let lastError;

    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const response = await port.fetch("http://container/health", {
          signal: AbortSignal.timeout(1000),
        });
        await response.body?.cancel();
        if (response.ok) return;
        lastError = new Error(`Health check returned ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    throw new Error(`Container did not become ready on port ${CONTAINER_PORT}`, {
      cause: lastError,
    });
  }
}

export default {
  async fetch(request, env) {
    const container = env.PROXY_CONTAINER.getByName(CONTAINER_INSTANCE);
    return container.fetch(request);
  },
};
