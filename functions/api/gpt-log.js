function json(status, body) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Invalid chat log." }); }
  const { user, prompt, response: answer, incognito } = body || {};
  if (typeof user !== "string" || typeof prompt !== "string" || typeof answer !== "string" || typeof incognito !== "boolean") {
    return json(400, { error: "Invalid chat log." });
  }

  let webhook;
  try {
    webhook = new URL(env.DISCORD_GPT_LOG_WEBHOOK || "");
    if (webhook.protocol !== "https:" || webhook.hostname !== "discord.com" || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(webhook.pathname)) throw new Error("Invalid webhook");
  } catch {
    return json(503, { error: "CheddarGPT logging is not configured." });
  }

  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `CheddarGPT message${incognito ? " [incognito]" : ""}`,
          color: 0x58a6ff,
          fields: [
            { name: "User", value: user.slice(0, 200) || "guest (unverified)" },
            { name: "Prompt", value: prompt.slice(0, 1000) || "(no text)" },
            { name: "Response", value: answer.slice(0, 1000) || "(pending)" },
          ],
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(10000),
    });
    return upstream.ok ? json(200, { ok: true }) : json(502, { error: "Discord could not accept the chat log." });
  } catch {
    return json(502, { error: "Could not reach Discord." });
  }
}
