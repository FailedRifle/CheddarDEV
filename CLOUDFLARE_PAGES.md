# Deploy CheddarOS on Cloudflare Pages

CheddarOS can still run with its existing Node server or Cloudflare Container deployment. For Pages, the build copies the full site (including the local games) and browser proxy modules into `dist/`, while Pages Functions provide the Wisp relay and the app's small `/api/*` handlers. The Pages config is separate from the existing Cloudflare Container config in `wrangler.jsonc`.

## Connect the repository

In Cloudflare, create a **new Pages project** named `cheeseburger-pages` from `FailedRifle/cheeseburger` and set:

- Framework preset: **None**
- Root directory: `/cloudflare-pages`
- Build command: `npm run build`
- Build output directory: `dist`

The Pages-specific config and dependencies live in `cloudflare-pages/`; keep the repository-root `wrangler.jsonc` for the Container Worker. The build does not deploy anything by itself. Every later Git update triggers a Pages build and updates the same project URL.

## Optional report logging

The report form and CheddarGPT logging remain available. Set these as encrypted Pages secrets only if you want those features connected to Discord:

- `DISCORD_REPORT_WEBHOOK`
- `DISCORD_GPT_LOG_WEBHOOK`

The browser connects to the same-origin `/wisp/` route, as Vaulted does. Pages relays the WebSocket to the same upstream (`https://lunaar.org/wisp/`) and preserves the validated Pages origin. If that endpoint changes, set the Pages variable `WISP_UPSTREAM` to another HTTPS Wisp URL ending in `/wisp/`. The browser checks the WebSocket before initializing the proxy and retries up to three times, with an eight-second timeout per attempt.

## Proxy transports

The browser uses Scramjet 2 with the Scramjet Controller and a same-origin Wisp WebSocket relay. Epoxy and Libcurl are the available transports. The client checks the Wisp connection before starting, registers the proxy service worker, waits for the controller, and keeps the worker alive while the browser is open. Ultraviolet and the older Scramjet assets are no longer part of the proxy runtime.

## Local Pages preview

From `cloudflare-pages/`, run `npm run build`, then `npx wrangler pages dev dist`. The build stages the Pages Functions under `cloudflare-pages/functions/` and copies the site to `cloudflare-pages/dist/`.
