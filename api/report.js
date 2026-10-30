const REPORT_CATEGORIES = new Set([
  "Website won’t load",
  "Search or address bar",
  "Tabs or navigation",
  "Bookmarks",
  "YouTube",
  "Cloud gaming",
  "Browser settings or appearance",
  "Other",
]);

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
    webhook = new URL(process.env.DISCORD_REPORT_WEBHOOK || "");
  } catch {
    sendJson(response, 503, { error: "Report submissions are not configured yet." });
    return;
  }
  if (webhook.protocol !== "https:" || webhook.hostname !== "discord.com" || !/^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(webhook.pathname)) {
    sendJson(response, 503, { error: "Report submissions are not configured yet." });
    return;
  }

  const { category, summary, description } = request.body || {};
  if (typeof category !== "string" || !REPORT_CATEGORIES.has(category)) {
    sendJson(response, 400, { error: "Choose a valid browser issue." });
    return;
  }
  if (typeof description !== "string" || !description.trim() || description.trim().length > 500) {
    sendJson(response, 400, { error: "Add a short description (up to 500 characters)." });
    return;
  }
  if (typeof summary !== "string" || !summary.trim() || summary.trim().length > 120) {
    sendJson(response, 400, { error: "Add a short summary (up to 120 characters)." });
    return;
  }

  const embed = {
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
  };
  try {
    const upstream = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      sendJson(response, 502, { error: "Discord could not accept the report. Please try again later." });
      return;
    }
    sendJson(response, 200, { ok: true });
  } catch {
    sendJson(response, 502, { error: "Could not reach Discord. Please try again later." });
  }
}
