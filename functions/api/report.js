const CATEGORIES = new Set([
  "Website won’t load",
  "Search or address bar",
  "Tabs or navigation",
  "Bookmarks",
  "Browser settings or appearance",
  "Other",
]);

function json(status, body) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json(405, { error: "Method not allowed." });
  let body;
  try { body = await request.json(); } catch { return json(400, { error: "Invalid report." }); }
  const { category, summary, description } = body || {};
  if (typeof category !== "string" || !CATEGORIES.has(category)) return json(400, { error: "Choose a valid browser issue." });
  if (typeof summary !== "string" || !summary.trim() || summary.trim().length > 120) return json(400, { error: "Add a short summary (up to 120 characters)." });
  if (typeof description !== "string" || !description.trim() || description.trim().length > 500) return json(400, { error: "Add a short description (up to 500 characters)." });

  let webhook;
  try {
    webhook = new URL(env.DISCORD_REPORT_WEBHOOK || "");
    if (webhook.protocol !== "https:" || webhook.hostname !== "discord.com" || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(webhook.pathname)) throw new Error("Invalid webhook");
  } catch {
    return json(503, { error: "Report submissions are not configured yet." });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "🐛 New Bug Report",
          color: 0xff5252,
          fields: [
            { name: "Reported By", value: "CheddarOS browser user", inline: true },
            { name: "Game", value: "CheddarOS Browser", inline: true },
            { name: "Bug Type", value: category, inline: true },
            { name: "Summary", value: summary.trim(), inline: false },
            { name: "Details", value: description.trim(), inline: false },
          ],
          footer: { text: "CheddarOS vALPHA-1.0.0" },
          timestamp: new Date().toISOString(),
        }],
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(10000),
    });
    return response.ok ? json(200, { ok: true }) : json(502, { error: "Discord could not accept the report. Please try again later." });
  } catch {
    return json(502, { error: "Could not reach Discord. Please try again later." });
  }
}
