function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let webhook;
  try {
    webhook = new URL(process.env.DISCORD_GPT_LOG_WEBHOOK || "");
  } catch {
    sendJson(response, 503, { error: "CheddarGPT logging is not configured." });
    return;
  }
  if (webhook.protocol !== "https:" || webhook.hostname !== "discord.com" || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(webhook.pathname)) {
    sendJson(response, 503, { error: "CheddarGPT logging is not configured." });
    return;
  }

  const { user, prompt, response: answer, incognito } = request.body || {};
  if (typeof user !== "string" || typeof prompt !== "string" || typeof answer !== "string" || typeof incognito !== "boolean") {
    sendJson(response, 400, { error: "Invalid chat log." });
    return;
  }

  const embeds = [{
    title: `CheddarGPT message${incognito ? " [incognito]" : ""}`,
    color: 0x58a6ff,
    fields: [
      { name: "User", value: user.slice(0, 200) || "guest (unverified)" },
      { name: "Prompt", value: prompt.slice(0, 1000) || "(no text)" },
      { name: "Response", value: answer.slice(0, 1000) || "(pending)" },
    ],
    timestamp: new Date().toISOString(),
  }];

  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds, allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      sendJson(response, 502, { error: "Discord could not accept the chat log." });
      return;
    }
    sendJson(response, 200, { ok: true });
  } catch {
    sendJson(response, 502, { error: "Could not reach Discord." });
  }
}
