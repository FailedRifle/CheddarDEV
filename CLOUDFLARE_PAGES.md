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

The browser proxy connects directly to `wss://lunaar.org/wisp/`, matching the working Cheddar deployment. The same-origin Pages `/wisp/` function is not used by the browser proxy because Cloudflare Pages closes that relayed WebSocket handshake (close code 1006).

## Proxy transports

The browser uses the proxy runtime assets bundled in `svg.zip`, with Vaulted’s URL codec and controller startup flow. The bundled controller is Scramjet-based under Vaulted’s renamed identifiers. Epoxy and OpenSSL are the available transports; both connect to the direct Wisp endpoint above.

## Local Pages preview

From `cloudflare-pages/`, run `npm run build`, then `npx wrangler pages dev dist`. The build stages the Pages Functions under `cloudflare-pages/functions/` and copies the site to `cloudflare-pages/dist/`.
